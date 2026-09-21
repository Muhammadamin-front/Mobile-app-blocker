package com.focusguard

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import android.util.Base64
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

class FocusGuardModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val database = FocusDatabase.get(context)
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "FocusGuard"

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  @ReactMethod
  fun getInstalledApps(promise: Promise) = background(promise) {
    val packageManager = context.packageManager
    val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val excluded = criticalPackages()
    val flags = if (Build.VERSION.SDK_INT >= 33) {
      android.content.pm.PackageManager.ResolveInfoFlags.of(0)
    } else null
    val resolved = if (Build.VERSION.SDK_INT >= 33) {
      packageManager.queryIntentActivities(launcherIntent, flags!!)
    } else {
      @Suppress("DEPRECATION")
      packageManager.queryIntentActivities(launcherIntent, 0)
    }
    resolved
      .asSequence()
      .mapNotNull { info ->
        val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
        if (packageName in excluded) return@mapNotNull null
        StoredApp(
          packageName = packageName,
          appName = info.loadLabel(packageManager).toString().ifBlank { packageName },
          iconBase64 = drawableToBase64(info.loadIcon(packageManager)),
        )
      }
      .distinctBy { it.packageName }
      .sortedBy { it.appName.lowercase() }
      .toList()
      .toWritableArray()
  }

  @ReactMethod
  fun getPermissionStatus(promise: Promise) {
    val enabled = isAccessibilityServiceEnabled()
    promise.resolve(Arguments.createMap().apply {
      putBoolean("accessibilityEnabled", enabled)
      putBoolean("ready", enabled)
    })
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context.currentActivity ?: context).startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", "Could not open Android Accessibility settings.", error)
    }
  }

  @ReactMethod
  fun startBlockingSession(input: ReadableMap, promise: Promise) {
    // Bridge values are only readable while this call is on the stack, so the
    // request is copied here and the database work happens on the executor.
    val id = input.requireString("id")
    val startTimestamp = input.requireLong("startTimestamp")
    val endTimestamp = input.requireLong("endTimestamp")
    val requested = input.getArray("blockedApps")?.toStoredApps().orEmpty()
    background(promise) {
      check(isAccessibilityServiceEnabled()) {
        "Enable the FocusGuard accessibility service before starting a session."
      }
      val excluded = criticalPackages()
      val apps = requested
        .filterNot { it.packageName in excluded }
        .filter { isLaunchable(it.packageName) }
      database.setSelectedApps(apps)
      val session = database.startSession(id, startTimestamp, endTimestamp, apps)
      FocusAccessibilityService.invalidateCache()
      session.toWritableMap()
    }
  }

  @ReactMethod
  fun stopBlockingSession(promise: Promise) = background(promise) {
    val stopped = database.stopSession()
    FocusAccessibilityService.invalidateCache()
    stopped?.toWritableMap()
  }

  @ReactMethod
  fun getActiveSession(promise: Promise) = background(promise) {
    database.getCurrentSession()?.toWritableMap()
  }

  @ReactMethod
  fun getHistory(promise: Promise) = background(promise) {
    Arguments.createArray().apply { database.getHistory().forEach { pushMap(it.toWritableMap()) } }
  }

  @ReactMethod
  fun getStatistics(promise: Promise) = background(promise) {
    val stats = database.getStatistics()
    Arguments.createMap().apply {
      putInt("completedSessions", stats["completedSessions"] as Int)
      putDouble("totalFocusMillis", (stats["totalFocusMillis"] as Long).toDouble())
      putInt("totalBlockedAttempts", stats["totalBlockedAttempts"] as Int)
      putArray("attemptsByPackage", Arguments.createArray().apply {
        @Suppress("UNCHECKED_CAST")
        (stats["attemptsByPackage"] as List<Map<String, Any>>).forEach { attempt ->
          pushMap(Arguments.createMap().apply {
            putString("packageName", attempt["packageName"] as String)
            putString("appName", attempt["appName"] as String)
            putInt("attempts", attempt["attempts"] as Int)
          })
        }
      })
    }
  }

  /** Drops apps the user has uninstalled since choosing them so the list never goes stale. */
  @ReactMethod
  fun getSelectedApps(promise: Promise) = background(promise) {
    val stored = database.getSelectedApps()
    val available = stored.filter { isLaunchable(it.packageName) }
    if (available.size != stored.size) {
      database.setSelectedApps(available)
    }
    available.toWritableArray()
  }

  /** Icons are fetched on demand instead of being persisted, so they stay out of the database. */
  @ReactMethod
  fun getAppIcons(packages: ReadableArray, promise: Promise) {
    val names = buildList {
      for (index in 0 until packages.size()) {
        packages.getString(index)?.takeIf { it.isNotBlank() }?.let(::add)
      }
    }
    background(promise) {
      val packageManager = context.packageManager
      Arguments.createMap().apply {
        names.forEach { packageName ->
          val drawable = try {
            packageManager.getApplicationIcon(packageName)
          } catch (_: Exception) {
            null
          }
          if (drawable != null) {
            drawableToBase64(drawable)?.let { putString(packageName, it) }
          }
        }
      }
    }
  }

  @ReactMethod
  fun setSelectedApps(apps: ReadableArray, promise: Promise) {
    val requested = apps.toStoredApps()
    background(promise) {
      val excluded = criticalPackages()
      database.setSelectedApps(requested.filterNot { it.packageName in excluded })
      null
    }
  }

  @ReactMethod
  fun getSettings(promise: Promise) = background(promise) {
    Arguments.createMap().apply {
      putBoolean("onboardingCompleted", database.getSetting(FocusDatabase.ONBOARDING_COMPLETED) == "true")
      putString("themePreference", database.getSetting(FocusDatabase.THEME_PREFERENCE) ?: "system")
    }
  }

  @ReactMethod
  fun completeOnboarding(promise: Promise) = background(promise) {
    database.setSetting(FocusDatabase.ONBOARDING_COMPLETED, "true")
    null
  }

  @ReactMethod
  fun setThemePreference(theme: String, promise: Promise) = background(promise) {
    require(theme in setOf("system", "light", "dark")) { "Invalid theme preference." }
    database.setSetting(FocusDatabase.THEME_PREFERENCE, theme)
    null
  }

  @ReactMethod
  fun resetAllData(promise: Promise) = background(promise) {
    database.resetAllData()
    FocusAccessibilityService.invalidateCache()
    null
  }

  private fun isAccessibilityServiceEnabled(): Boolean {
    val manager = context.getSystemService(AccessibilityManager::class.java)
    return manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      .any { ComponentName.unflattenFromString(it.resolveInfo.serviceInfo.packageName + "/" + it.resolveInfo.serviceInfo.name) == ComponentName(context, FocusAccessibilityService::class.java) }
  }

  private fun criticalPackages(): Set<String> {
    val packages = mutableSetOf(
      context.packageName,
      "com.android.settings",
      "com.android.systemui",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      "com.android.packageinstaller",
    )
    context.packageManager.resolveActivity(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      android.content.pm.PackageManager.MATCH_DEFAULT_ONLY,
    )?.activityInfo?.packageName?.let(packages::add)
    context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let(packages::add)
    runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()?.let(packages::add)
    return packages
  }

  private fun isLaunchable(packageName: String): Boolean =
    runCatching { context.packageManager.getLaunchIntentForPackage(packageName) }.getOrNull() != null

  private fun drawableToBase64(drawable: Drawable): String? = try {
    val source = (drawable as? BitmapDrawable)?.bitmap
    val bitmap = source?.let { Bitmap.createScaledBitmap(it, 96, 96, true) }
      ?: Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888).also { bitmap ->
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
      }
    ByteArrayOutputStream().use { stream ->
      bitmap.compress(Bitmap.CompressFormat.PNG, 85, stream)
      Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }
  } catch (_: Exception) {
    null
  }

  private fun background(promise: Promise, block: () -> Any?) {
    executor.execute {
      try {
        promise.resolve(block())
      } catch (error: Exception) {
        promise.reject("FOCUS_GUARD_ERROR", error.message ?: "FocusGuard operation failed.", error)
      }
    }
  }

  private fun ReadableMap.requireString(key: String): String =
    if (hasKey(key) && !isNull(key)) getString(key).orEmpty() else error("Missing $key.")

  private fun ReadableMap.requireLong(key: String): Long =
    if (hasKey(key) && !isNull(key)) getDouble(key).toLong() else error("Missing $key.")

  private fun ReadableArray.toStoredApps(): List<StoredApp> = buildList {
    for (index in 0 until size()) {
      val map = getMap(index) ?: continue
      val packageName = map.getString("packageName").orEmpty()
      if (packageName.isNotBlank()) {
        val icon = if (map.hasKey("iconBase64") && !map.isNull("iconBase64")) map.getString("iconBase64") else null
        add(StoredApp(packageName, map.getString("appName") ?: packageName, icon))
      }
    }
  }

  private fun List<StoredApp>.toWritableArray(): WritableArray = Arguments.createArray().apply {
    forEach { pushMap(it.toWritableMap()) }
  }

  private fun StoredApp.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putString("packageName", packageName)
    putString("appName", appName)
    iconBase64?.let { putString("iconBase64", it) }
  }

  private fun StoredSession.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putString("id", id)
    putDouble("startTimestamp", startTimestamp.toDouble())
    putDouble("endTimestamp", endTimestamp.toDouble())
    putArray("blockedApps", blockedApps.toWritableArray())
    putString("status", status)
    completedReason?.let { putString("completedReason", it) }
    putInt("blockedAttempts", blockedAttempts)
    putDouble("remainingMillis", database.remainingMillis(this@toWritableMap).toDouble())
    putDouble("startsInMillis", database.startsInMillis(this@toWritableMap).toDouble())
  }
}

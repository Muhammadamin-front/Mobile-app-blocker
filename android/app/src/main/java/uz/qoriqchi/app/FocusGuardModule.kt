package uz.qoriqchi.app

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
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
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
import com.facebook.react.bridge.UiThreadUtil
import java.io.ByteArrayOutputStream
import java.util.Locale
import java.util.concurrent.Executors

class FocusGuardModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val database = FocusDatabase.get(context)
  private val usageReporter = UsageReporter(context)
  private val executor = Executors.newSingleThreadExecutor()
  private val billing by lazy { ProBilling(context) }

  override fun getName(): String = "FocusGuard"

  override fun initialize() {
    super.initialize()
    // The stored choice has to reach Android itself, or the block screen and the
    // notification keep speaking the phone's language instead of the app's.
    executor.execute {
      val stored = runCatching {
        database.getSetting(FocusDatabase.LANGUAGE_PREFERENCE)
      }.getOrNull() ?: "system"
      applyLocale(stored)
      // The alarm does not survive a reinstall or a cleared app, so it is re-armed
      // whenever the module comes up rather than only when a schedule is edited.
      runCatching { FocusScheduler.sync(context) }
    }
  }

  private fun applyLocale(language: String) {
    UiThreadUtil.runOnUiThread {
      runCatching {
        AppCompatDelegate.setApplicationLocales(
          if (language == "system") {
            LocaleListCompat.getEmptyLocaleList()
          } else {
            LocaleListCompat.forLanguageTags(language)
          },
        )
      }
    }
  }

  override fun invalidate() {
    executor.shutdownNow()
    billing.close()
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
    // The app polls this during a session, which makes it a second place to notice
    // protection being switched off when the foreground service could not run.
    executor.execute { SessionIntegrity.check(context) }
    promise.resolve(Arguments.createMap().apply {
      putBoolean("accessibilityEnabled", enabled)
      // Usage access is optional: blocking is ready without it.
      putBoolean("usageAccessEnabled", usageReporter.hasAccess())
      // Optional too, but it decides whether OEM battery managers leave the session alone.
      putBoolean("batteryUnrestricted", isIgnoringBatteryOptimizations())
      putString("manufacturer", Build.MANUFACTURER.orEmpty().lowercase())
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
  fun openBatterySettings(promise: Promise) {
    // The list screen needs no permission. Asking for the exemption directly would
    // need REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which Play restricts.
    val launcher = context.currentActivity ?: context
    val attempts = listOf(
      Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(android.net.Uri.parse("package:" + context.packageName)),
    )
    for (intent in attempts) {
      try {
        launcher.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        promise.resolve(null)
        return
      } catch (_: Exception) {
        // try the next screen
      }
    }
    promise.reject("OPEN_SETTINGS_FAILED", "Could not open battery settings.")
  }

  private fun isIgnoringBatteryOptimizations(): Boolean = try {
    context.getSystemService(android.os.PowerManager::class.java)
      ?.isIgnoringBatteryOptimizations(context.packageName) == true
  } catch (_: Exception) {
    false
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context.currentActivity ?: context).startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", "Could not open Android usage access settings.", error)
    }
  }

  @ReactMethod
  fun getScreenTime(range: String?, promise: Promise) = background(promise) {
    usageReporter.report(range).toWritableMap()
  }

  @ReactMethod
  fun startBlockingSession(input: ReadableMap, promise: Promise) {
    // Bridge values are only readable while this call is on the stack, so the
    // request is copied here and the database work happens on the executor.
    val id = input.requireString("id")
    val startTimestamp = input.requireLong("startTimestamp")
    val endTimestamp = input.requireLong("endTimestamp")
    val requested = input.getArray("blockedApps")?.toStoredApps().orEmpty()
    val strict = input.hasKey("strict") && !input.isNull("strict") && input.getBoolean("strict")
    background(promise) {
      check(isAccessibilityServiceEnabled()) {
        "Enable the FocusGuard accessibility service before starting a session."
      }
      // Checked here as well as in the UI: the entitlement is the rule, not the button.
      check(!strict || ProStore.isUnlocked(context)) { "Strict sessions are part of Qoriqchi Pro." }
      val excluded = criticalPackages()
      val apps = requested
        .filterNot { it.packageName in excluded }
        .filter { isLaunchable(it.packageName) }
      database.setSelectedApps(apps)
      val session = database.startSession(id, startTimestamp, endTimestamp, apps, strict)
      FocusAccessibilityService.invalidateCache()
      FocusNotifier.sync(context)
      FocusScheduler.sync(context)
      session.toWritableMap()
    }
  }

  @ReactMethod
  fun stopBlockingSession(promise: Promise) = background(promise) {
    val stopped = database.stopSession()
    FocusAccessibilityService.invalidateCache()
    FocusNotifier.sync(context)
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
  fun getStreak(promise: Promise) = background(promise) {
    val streak = database.getStreak()
    Arguments.createMap().apply {
      putInt("current", streak.current)
      putInt("best", streak.best)
      putBoolean("todayDone", streak.todayDone)
      putInt("minMinutes", StreakMath.MIN_MINUTES)
    }
  }

  @ReactMethod
  fun getTrends(range: String?, promise: Promise) = background(promise) {
    database.getTrends(range).toWritableMap()
  }

  @ReactMethod
  fun getBooks(promise: Promise) = background(promise) {
    val selected = database.getSelectedBook()
    val (seen, learned) = database.getWordStats()
    Arguments.createMap().apply {
      putString("selected", selected)
      putString("material", database.getBlockMaterial())
      putMap("words", Arguments.createMap().apply {
        putInt("deckSize", WordDeck.words(context).size)
        putInt("seen", seen)
        putInt("learned", learned)
      })
      putInt("pagesRead", database.getPagesRead())
      putArray("books", Arguments.createArray().apply {
        BookLibrary.catalog(context).forEach { book ->
          pushMap(Arguments.createMap().apply {
            putString("id", book.id)
            putString("title", book.title)
            putString("author", book.author)
            putInt("year", book.year)
            putString("license", book.license)
            putString("source", book.source)
            putInt("pageCount", BookLibrary.pages(context, book.id).size)
            putInt("page", database.getBookPage(book.id))
          })
        }
      })
    }
  }

  @ReactMethod
  fun selectBook(id: String?, promise: Promise) = background(promise) {
    require(id == null || BookLibrary.book(context, id) != null) { "Unknown book." }
    database.setSelectedBook(id)
    database.setBlockMaterial(if (id == null) "timer" else "book")
    null
  }

  @ReactMethod
  fun selectWords(promise: Promise) = background(promise) {
    database.setBlockMaterial("words")
    null
  }

  /** The cached entitlement right away; Play's answer, when it comes, refreshes it. */
  @ReactMethod
  fun getPro(promise: Promise) {
    billing.refresh { status -> promise.resolve(status.toWritableMap()) }
  }

  @ReactMethod
  fun buyPro(promise: Promise) {
    val activity = context.currentActivity
    billing.refresh {
      billing.buy(activity) { result ->
        result.fold(
          onSuccess = { promise.resolve(it.toWritableMap()) },
          onFailure = { promise.reject("PRO_PURCHASE_FAILED", it.message ?: "The purchase did not go through.", it) },
        )
      }
    }
  }

  @ReactMethod
  fun getExam(promise: Promise) = background(promise) {
    ExamCountdown.read(database)?.let { exam ->
      Arguments.createMap().apply {
        putString("kind", exam.kind)
        putString("label", exam.label)
        putString("date", exam.date)
      }
    }
  }

  /** Null clears it. */
  @ReactMethod
  fun setExam(input: ReadableMap?, promise: Promise) {
    val exam = input?.let {
      StoredExam(
        kind = it.requireString("kind"),
        label = if (it.hasKey("label") && !it.isNull("label")) it.getString("label").orEmpty() else "",
        date = it.requireString("date"),
      )
    }
    background(promise) {
      ExamCountdown.write(database, exam)
      null
    }
  }

  /** Android's own date picker, so no date library ships in the app. Resolves yyyy-mm-dd or null. */
  @ReactMethod
  fun pickDate(initial: String?, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.resolve(null)
      return
    }
    UiThreadUtil.runOnUiThread {
      val start = java.util.Calendar.getInstance()
      initial?.let(ExamCountdown::dayOfDate)?.let { day ->
        start.timeZone = java.util.TimeZone.getTimeZone("UTC")
        start.timeInMillis = day * 86_400_000L
      }
      var answered = false
      val dialog = android.app.DatePickerDialog(
        activity,
        R.style.QoriqchiDatePicker,
        { _, year, month, day ->
          answered = true
          promise.resolve(String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, day))
        },
        start.get(java.util.Calendar.YEAR),
        start.get(java.util.Calendar.MONTH),
        start.get(java.util.Calendar.DAY_OF_MONTH),
      )
      dialog.datePicker.minDate = System.currentTimeMillis() - 1_000L
      dialog.setOnDismissListener { if (!answered) promise.resolve(null) }
      dialog.show()
    }
  }

  /**
   * Draws this week's card and opens Android's share sheet with it — straight into
   * Telegram when asked and installed, the chooser otherwise. Nothing leaves the phone
   * unless the person picks where it goes.
   */
  @ReactMethod
  fun shareProgress(target: String?, promise: Promise) = background(promise) {
    val summary = ShareCard.summarize(context)
    val file = ShareCard.render(context, summary)
    val uri = androidx.core.content.FileProvider.getUriForFile(context, context.packageName + ".share", file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TEXT, ShareCard.caption(context, summary))
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val launcher = context.currentActivity ?: context
    val telegram = if (target == "telegram") {
      TELEGRAM_PACKAGES.firstNotNullOfOrNull { pkg ->
        Intent(send).setPackage(pkg).takeIf { it.resolveActivity(context.packageManager) != null }
      }
    } else null
    UiThreadUtil.runOnUiThread {
      runCatching {
        launcher.startActivity(
          (telegram ?: Intent.createChooser(send, null)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }.onFailure {
        launcher.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
    telegram != null
  }

  @ReactMethod
  fun getSchedules(promise: Promise) = background(promise) {
    Arguments.createArray().apply {
      database.getSchedules().forEach { pushMap(it.toWritableMap()) }
    }
  }

  @ReactMethod
  fun saveSchedule(input: ReadableMap, promise: Promise) {
    val schedule = StoredSchedule(
      id = input.requireString("id"),
      label = if (input.hasKey("label") && !input.isNull("label")) {
        input.getString("label").orEmpty()
      } else {
        ""
      },
      days = input.requireInt("days"),
      startMinute = input.requireInt("startMinute"),
      durationMinutes = input.requireInt("durationMinutes"),
      strict = input.hasKey("strict") && !input.isNull("strict") && input.getBoolean("strict"),
      enabled = !input.hasKey("enabled") || input.isNull("enabled") || input.getBoolean("enabled"),
    )
    background(promise) {
      check(!schedule.strict || ProStore.isUnlocked(context)) { "Strict schedules are part of Qoriqchi Pro." }
      database.saveSchedule(schedule)
      FocusScheduler.sync(context)
      null
    }
  }

  @ReactMethod
  fun deleteSchedule(id: String, promise: Promise) = background(promise) {
    database.deleteSchedule(id)
    FocusScheduler.sync(context)
    null
  }

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
      putString("language", database.getSetting(FocusDatabase.LANGUAGE_PREFERENCE) ?: "system")
      // What the phone itself is set to, so "system" can resolve without guessing.
      putString("deviceLanguage", Locale.getDefault().language)
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
  fun setLanguagePreference(language: String, promise: Promise) = background(promise) {
    require(language in setOf("system", "en", "uz")) { "Invalid language preference." }
    database.setSetting(FocusDatabase.LANGUAGE_PREFERENCE, language)
    // Also moves the native side — the block screen and the timer notification read
    // Android resources, not the JavaScript dictionary.
    applyLocale(language)
    null
  }

  @ReactMethod
  fun resetAllData(promise: Promise) = background(promise) {
    database.resetAllData()
    FocusAccessibilityService.invalidateCache()
    FocusNotifier.clear(context)
    null
  }

  private companion object {
    /** Telegram and its official alternative clients. */
    val TELEGRAM_PACKAGES = listOf("org.telegram.messenger", "org.telegram.messenger.web", "org.thunderdog.challegram")
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

  private fun ReadableMap.requireInt(key: String): Int =
    if (hasKey(key) && !isNull(key)) getDouble(key).toInt() else error("Missing $key.")

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

  private fun ScreenTimeReport.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putBoolean("available", available)
    putDouble("windowStart", windowStart.toDouble())
    putDouble("totalMillis", totalMillis.toDouble())
    putArray("apps", Arguments.createArray().apply {
      apps.forEach { app ->
        pushMap(Arguments.createMap().apply {
          putString("packageName", app.packageName)
          putString("appName", app.appName)
          putDouble("usageMillis", app.usageMillis.toDouble())
        })
      }
    })
  }

  private fun ProStatus.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putBoolean("unlocked", unlocked)
    putBoolean("available", available)
    if (price != null) putString("price", price) else putNull("price")
    putBoolean("pending", pending)
  }

  private fun StoredSchedule.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putString("id", id)
    putString("label", label)
    putInt("days", days)
    putInt("startMinute", startMinute)
    putInt("durationMinutes", durationMinutes)
    putBoolean("strict", strict)
    putBoolean("enabled", enabled)
  }

  private fun FocusTrends.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putString("range", range)
    putDouble("windowStart", windowStart.toDouble())
    putDouble("totalFocusMillis", totalFocusMillis.toDouble())
    putInt("completedSessions", completedSessions)
    putInt("blockedAttempts", blockedAttempts)
    putArray("buckets", Arguments.createArray().apply {
      buckets.forEach { bucket ->
        pushMap(Arguments.createMap().apply {
          putString("label", bucket.label)
          putDouble("startTimestamp", bucket.startTimestamp.toDouble())
          putDouble("focusMillis", bucket.focusMillis.toDouble())
        })
      }
    })
    putArray("topApps", Arguments.createArray().apply {
      topApps.forEach { app ->
        pushMap(Arguments.createMap().apply {
          putString("packageName", app.packageName)
          putString("appName", app.appName)
          putInt("attempts", app.attempts)
        })
      }
    })
  }

  private fun StoredSession.toWritableMap(): WritableMap = Arguments.createMap().apply {
    putString("id", id)
    putDouble("startTimestamp", startTimestamp.toDouble())
    putDouble("endTimestamp", endTimestamp.toDouble())
    putArray("blockedApps", blockedApps.toWritableArray())
    putString("status", status)
    completedReason?.let { putString("completedReason", it) }
    putInt("blockedAttempts", blockedAttempts)
    putBoolean("strict", strict)
    brokenAt?.let { putDouble("brokenAt", it.toDouble()) }
    putDouble("remainingMillis", database.remainingMillis(this@toWritableMap).toDouble())
    putDouble("startsInMillis", database.startsInMillis(this@toWritableMap).toDouble())
  }
}

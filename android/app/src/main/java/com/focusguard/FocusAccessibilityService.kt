package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import java.util.concurrent.Executors

/**
 * Detects which app moved to the foreground and shows [BlockActivity] when that package is part of
 * the active session. The service keeps an in-memory snapshot of the session so a window change
 * costs no database work, and every enforcement step is guarded: a failure here must never take the
 * process down, because the user would silently lose blocking.
 */
class FocusAccessibilityService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private val writer = Executors.newSingleThreadExecutor()
  private var database: FocusDatabase? = null
  private var session: StoredSession? = null
  private var blockedApps: Map<String, StoredApp> = emptyMap()
  private var sessionEndElapsed = 0L
  private var cacheValidUntilElapsed = 0L
  private var lastBlockedPackage: String? = null
  private var lastBlockElapsed = 0L

  /** Android can refuse a background activity start. Falling back to Home still ends the app use. */
  private val homeFallback = Runnable {
    if (!BlockActivity.isVisible) {
      Log.w(TAG, "Block screen did not reach the foreground; falling back to the home screen.")
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    database = FocusDatabase.get(this)
    invalidateCache()
    val db = database
    if (db != null) {
      writer.execute {
        runCatching {
          db.normalizeSessions()
          FocusNotifier.sync(applicationContext)
        }
      }
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    try {
      handleEvent(event)
    } catch (error: Throwable) {
      Log.w(TAG, "Foreground check failed; enforcement retries on the next window change.", error)
    }
  }

  private fun handleEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (packageName == applicationContext.packageName || packageName in NEVER_BLOCK) return

    refreshSnapshotIfStale()
    val current = session ?: return
    val blockedApp = blockedApps[packageName] ?: return

    val nowElapsed = SystemClock.elapsedRealtime()
    val duplicate =
      lastBlockedPackage == packageName && nowElapsed - lastBlockElapsed < BLOCK_DEBOUNCE_MILLIS
    lastBlockedPackage = packageName
    lastBlockElapsed = nowElapsed
    if (!duplicate) {
      val db = database
      if (db != null) {
        writer.execute { runCatching { db.recordAttempt(current, blockedApp) } }
      }
    }

    showBlockScreen(blockedApp, (sessionEndElapsed - nowElapsed).coerceAtLeast(0L))
  }

  private fun showBlockScreen(blockedApp: StoredApp, remainingMillis: Long) {
    val intent = Intent(this, BlockActivity::class.java).apply {
      putExtra(BlockActivity.EXTRA_PACKAGE_NAME, blockedApp.packageName)
      putExtra(BlockActivity.EXTRA_APP_NAME, blockedApp.appName)
      putExtra(BlockActivity.EXTRA_REMAINING_MILLIS, remainingMillis)
      // Seeded by the session so the quote holds still for as long as it is running.
      putExtra(BlockActivity.EXTRA_QUOTE_SEED, session?.id?.hashCode() ?: 0)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
    }
    handler.removeCallbacks(homeFallback)
    val launched = try {
      startActivity(intent)
      true
    } catch (error: Exception) {
      Log.w(TAG, "Could not start the block screen.", error)
      false
    }
    if (launched) {
      handler.postDelayed(homeFallback, BLOCK_SCREEN_TIMEOUT_MILLIS)
    } else {
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
  }

  /**
   * Re-reads the session at most every few seconds, and always the moment the cached session is due
   * to expire, so a window change stays allocation-cheap and free of disk work.
   */
  private fun refreshSnapshotIfStale() {
    val now = SystemClock.elapsedRealtime()
    if (!cacheDirty && now < cacheValidUntilElapsed) return
    cacheDirty = false

    val db = database
    if (db == null) {
      clearSnapshot(now)
      return
    }
    val current = runCatching { db.getEnforceableSession() }.getOrNull()
    if (current == null) {
      clearSnapshot(now)
      return
    }
    val remaining = runCatching { db.remainingMillis(current) }.getOrDefault(0L)
    session = current
    blockedApps = current.blockedApps.associateBy { it.packageName }
    sessionEndElapsed = now + remaining
    cacheValidUntilElapsed = now + FocusClock.cacheWindowMillis(remaining, CACHE_MILLIS)
  }

  private fun clearSnapshot(now: Long) {
    // A session that just ended leaves its notification behind unless we retire it.
    if (session != null) {
      writer.execute { runCatching { FocusNotifier.sync(applicationContext) } }
    }
    session = null
    blockedApps = emptyMap()
    sessionEndElapsed = 0L
    cacheValidUntilElapsed = now + CACHE_MILLIS
  }

  override fun onInterrupt() = Unit

  override fun onUnbind(intent: Intent?): Boolean {
    handler.removeCallbacks(homeFallback)
    invalidateCache()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    handler.removeCallbacks(homeFallback)
    writer.shutdown()
    super.onDestroy()
  }

  companion object {
    private const val TAG = "FocusGuard"
    private const val BLOCK_DEBOUNCE_MILLIS = 1_500L
    private const val CACHE_MILLIS = 4_000L
    private const val BLOCK_SCREEN_TIMEOUT_MILLIS = 900L

    @Volatile private var cacheDirty = true

    /** Called whenever React Native or a broadcast changes the persisted session. */
    fun invalidateCache() {
      cacheDirty = true
    }

    private val NEVER_BLOCK = setOf(
      "com.android.settings",
      "com.android.systemui",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      "com.android.packageinstaller",
    )
  }
}

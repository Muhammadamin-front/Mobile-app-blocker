package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

class FocusAccessibilityService : AccessibilityService() {
  private lateinit var database: FocusDatabase
  private var lastBlockedPackage: String? = null
  private var lastBlockElapsed = 0L

  override fun onServiceConnected() {
    super.onServiceConnected()
    database = FocusDatabase.get(this)
    database.normalizeSessions()
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (packageName == applicationContext.packageName || packageName in NEVER_BLOCK) return

    val session = database.getEnforceableSession() ?: return
    val blockedApp = session.blockedApps.firstOrNull { it.packageName == packageName } ?: return
    val nowElapsed = SystemClock.elapsedRealtime()
    val duplicate = lastBlockedPackage == packageName && nowElapsed - lastBlockElapsed < BLOCK_DEBOUNCE_MILLIS
    if (!duplicate) {
      database.recordAttempt(session, blockedApp)
      lastBlockedPackage = packageName
      lastBlockElapsed = nowElapsed
    }

    val intent = Intent(this, BlockActivity::class.java).apply {
      putExtra(BlockActivity.EXTRA_PACKAGE_NAME, blockedApp.packageName)
      putExtra(BlockActivity.EXTRA_APP_NAME, blockedApp.appName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
    }
    startActivity(intent)
  }

  override fun onInterrupt() = Unit

  companion object {
    private const val BLOCK_DEBOUNCE_MILLIS = 1_500L
    private val NEVER_BLOCK = setOf(
      "com.android.settings",
      "com.android.systemui",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      "com.android.packageinstaller",
    )
  }
}

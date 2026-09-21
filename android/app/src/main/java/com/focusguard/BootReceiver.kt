package com.focusguard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Re-evaluates persisted sessions after a reboot, a clock change, or an app update. The work runs
 * off the main thread because a broadcast receiver must not touch the database inline.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action
    if (action !in SUPPORTED_ACTIONS) return
    val pending = goAsync()
    val appContext = context.applicationContext
    Thread {
      try {
        FocusDatabase.get(appContext).normalizeSessions()
        FocusAccessibilityService.invalidateCache()
      } catch (error: Throwable) {
        Log.w(TAG, "Could not normalize sessions after $action.", error)
      } finally {
        pending.finish()
      }
    }.start()
  }

  companion object {
    private const val TAG = "FocusGuard"
    private val SUPPORTED_ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
    )
  }
}

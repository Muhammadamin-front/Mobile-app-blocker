package uz.qoriqchi.app

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.util.Log

/**
 * Notices when protection is switched off while a session runs and writes it down.
 *
 * Qoriqchi never stops anyone from turning the service off — Android guarantees that,
 * and using Accessibility to prevent it would break Play policy. What it can do is be
 * honest about it: the session is recorded as broken and stops counting toward the
 * streak. That is the accountability strict mode promises, without trapping anyone.
 *
 * The check reads the user's Accessibility setting, not whether the service is bound
 * at this instant, so a reboot or an OEM killing the process is never mistaken for
 * the owner switching protection off.
 */
object SessionIntegrity {
  private const val TAG = "FocusGuard"

  fun isProtectionOn(context: Context): Boolean {
    val resolver = context.contentResolver
    val on = runCatching { Settings.Secure.getInt(resolver, Settings.Secure.ACCESSIBILITY_ENABLED) == 1 }
      .getOrDefault(false)
    if (!on) return false
    val enabled = Settings.Secure.getString(resolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
      ?: return false
    val ours = ComponentName(context, FocusAccessibilityService::class.java)
    return enabled.split(':').any { ComponentName.unflattenFromString(it.trim()) == ours }
  }

  /** Marks the running session broken if protection is off. Returns true if it just did. */
  fun check(context: Context): Boolean {
    val appContext = context.applicationContext
    return try {
      val database = FocusDatabase.get(appContext)
      val session = database.getEnforceableSession() ?: return false
      if (session.brokenAt != null || isProtectionOn(appContext)) return false
      val marked = database.markBroken(session.id)
      if (marked) {
        Log.i(TAG, "Protection was turned off during session ${session.id}.")
        FocusNotifier.sync(appContext)
      }
      marked
    } catch (error: Throwable) {
      Log.w(TAG, "Could not check session integrity.", error)
      false
    }
  }
}

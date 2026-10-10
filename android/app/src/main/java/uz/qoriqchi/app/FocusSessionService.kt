package uz.qoriqchi.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log

/**
 * Runs only while a session does, and exists for one reason: to keep the process
 * alive. The accessibility service that enforces blocking lives in this process,
 * and on a OnePlus 7 Pro "close all" in recents killed it and Android did not
 * rebind it — blocked apps opened freely while the session still showed as active.
 * A foreground service is the one thing those task killers leave alone.
 *
 * It owns no logic of its own: the notification is FocusNotifier's, the session is
 * the database's, and it stops itself the moment there is nothing to protect. While it
 * runs it also watches the Accessibility setting, so switching protection off during
 * a session is recorded the moment it happens (see SessionIntegrity).
 */
class FocusSessionService : Service() {

  private val settingsObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
    override fun onChange(selfChange: Boolean) {
      Thread { SessionIntegrity.check(this@FocusSessionService) }.start()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    runCatching {
      contentResolver.registerContentObserver(
        Settings.Secure.getUriFor(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES),
        false,
        settingsObserver,
      )
      contentResolver.registerContentObserver(
        Settings.Secure.getUriFor(Settings.Secure.ACCESSIBILITY_ENABLED),
        false,
        settingsObserver,
      )
    }
  }

  override fun onDestroy() {
    runCatching { contentResolver.unregisterContentObserver(settingsObserver) }
    super.onDestroy()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = try {
      FocusNotifier.current(this)
    } catch (error: Throwable) {
      Log.w(TAG, "Could not read the session for the foreground service.", error)
      null
    }
    if (notification == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          FocusNotifier.NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        )
      } else {
        startForeground(FocusNotifier.NOTIFICATION_ID, notification)
      }
    } catch (error: Exception) {
      Log.w(TAG, "Android refused the foreground service; the session runs without it.", error)
      stopSelf()
      return START_NOT_STICKY
    }
    // If something kills it anyway, Android brings it back and the check above
    // either restores protection or lets it go if the session has ended meanwhile.
    return START_STICKY
  }

  companion object {
    private const val TAG = "FocusGuard"

    /** Returns false when Android will not allow a foreground start from here. */
    fun start(context: Context): Boolean = try {
      val intent = Intent(context, FocusSessionService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    } catch (error: Exception) {
      // Android 12+ refuses foreground starts from some background contexts.
      Log.w(TAG, "Could not start the session service.", error)
      false
    }

    fun stop(context: Context) {
      runCatching { context.stopService(Intent(context, FocusSessionService::class.java)) }
    }
  }
}

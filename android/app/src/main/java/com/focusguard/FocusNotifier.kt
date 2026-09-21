package com.focusguard

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Keeps the remaining time on the status bar and the lock screen while a session runs.
 *
 * The countdown is handed to the system as a chronometer rather than being redrawn by
 * the app, so it keeps ticking while the process is idle and costs nothing to run. No
 * foreground service is involved: the accessibility service already keeps the process
 * alive, and a session timer does not justify holding one.
 */
object FocusNotifier {
  private const val TAG = "FocusGuard"
  // Channel settings belong to the user once created, so a behaviour change needs a new id.
  private const val CHANNEL_ID = "focus_timer"
  private const val NOTIFICATION_ID = 1001
  const val ACTION_SESSION_DUE = "com.focusguard.SESSION_DUE"

  /** Reposts or clears the notification to match whatever is actually stored. */
  fun sync(context: Context) {
    val appContext = context.applicationContext
    try {
      val database = FocusDatabase.get(appContext)
      val session = database.getCurrentSession()
      if (session == null) {
        clear(appContext)
        cancelAlarm(appContext)
        return
      }
      val startsIn = database.startsInMillis(session)
      val remaining = database.remainingMillis(session)
      if (remaining <= 0L) {
        clear(appContext)
        cancelAlarm(appContext)
        return
      }
      show(appContext, session, startsIn, remaining)
      scheduleAlarm(appContext, if (startsIn > 0L) startsIn else remaining)
    } catch (error: Throwable) {
      Log.w(TAG, "Could not update the session notification.", error)
    }
  }

  fun clear(context: Context) {
    manager(context)?.cancel(NOTIFICATION_ID)
  }

  private fun show(
    context: Context,
    session: StoredSession,
    startsInMillis: Long,
    remainingMillis: Long,
  ) {
    val manager = manager(context) ?: return
    ensureChannel(manager, context)

    val scheduled = startsInMillis > 0L
    val count = session.blockedApps.size
    val subtitle = if (scheduled) {
      context.getString(R.string.notification_starts_soon)
    } else if (count == 1) {
      context.getString(R.string.notification_blocked_apps, count)
    } else {
      context.getString(R.string.notification_blocked_apps_plural, count)
    }

    val content = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentIntent = PendingIntent.getActivity(
      context,
      0,
      content,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    builder
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(
        context.getString(
          if (scheduled) R.string.notification_scheduled_title else R.string.notification_title,
        ),
      )
      .setContentText(subtitle)
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .setShowWhen(true)
      .setOnlyAlertOnce(true)
      // The whole point is to be readable without unlocking.
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setUsesChronometer(true)
      .setWhen(System.currentTimeMillis() + if (scheduled) startsInMillis else remainingMillis)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      builder.setChronometerCountDown(true)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      builder.setCategory(Notification.CATEGORY_STOPWATCH)
    }

    try {
      manager.notify(NOTIFICATION_ID, builder.build())
    } catch (error: SecurityException) {
      // The user has not granted notifications. Blocking is unaffected.
      Log.i(TAG, "Notifications are not permitted; the session runs without one.")
    }
  }

  private fun ensureChannel(manager: NotificationManager, context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.notification_channel_name),
      // Default importance keeps it on the lock screen, where Android files
      // low-importance notifications away. Sound and vibration are removed
      // instead: a focus timer must never interrupt the focus it is counting.
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = context.getString(R.string.notification_channel_description)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(false)
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  /**
   * An inexact alarm is enough to retire the notification: it needs no permission, and
   * any app switch refreshes the same state through the accessibility service anyway.
   */
  private fun scheduleAlarm(context: Context, delayMillis: Long) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = alarmIntent(context) ?: return
    val triggerAt = System.currentTimeMillis() + delayMillis.coerceAtLeast(1_000L)
    try {
      alarms.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
    } catch (error: Exception) {
      Log.w(TAG, "Could not schedule the session alarm.", error)
    }
  }

  private fun cancelAlarm(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    alarmIntent(context)?.let(alarms::cancel)
  }

  private fun alarmIntent(context: Context): PendingIntent? = PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, BootReceiver::class.java).setAction(ACTION_SESSION_DUE),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun manager(context: Context): NotificationManager? =
    context.getSystemService(NotificationManager::class.java)
}

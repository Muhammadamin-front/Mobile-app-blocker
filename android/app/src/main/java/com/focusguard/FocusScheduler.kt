package com.focusguard

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.UUID

/**
 * Turns saved schedules into sessions. One alarm is kept for the soonest upcoming
 * start; when it fires the schedule that is due starts a session and the next alarm
 * is set. An inexact alarm is enough — a focus block that begins a minute late is
 * still a focus block, and it costs the user no permission to grant.
 */
object FocusScheduler {
  private const val TAG = "FocusGuard"
  const val ACTION_SCHEDULE_DUE = "com.focusguard.SCHEDULE_DUE"
  private const val REQUEST_CODE = 2001

  /** How late an alarm may arrive and still count as "this is the one that fired". */
  private const val DUE_WINDOW_MILLIS = 5 * 60_000L

  /** Re-arms the alarm for whichever enabled schedule comes next. */
  fun sync(context: Context) {
    val appContext = context.applicationContext
    try {
      val schedules = FocusDatabase.get(appContext).getSchedules().filter { it.enabled }
      val now = System.currentTimeMillis()
      val next = ScheduleMath.earliest(
        schedules.map { ScheduleMath.nextOccurrence(now, it.days, it.startMinute) },
      )
      val alarms = appContext.getSystemService(AlarmManager::class.java) ?: return
      val pending = pendingIntent(appContext) ?: return
      if (next == null) {
        alarms.cancel(pending)
        return
      }
      alarms.set(AlarmManager.RTC_WAKEUP, next, pending)
    } catch (error: Throwable) {
      Log.w(TAG, "Could not arm the schedule alarm.", error)
    }
  }

  /**
   * Starts whatever is due now. A session already running wins: a schedule never
   * interrupts focus that is already under way, and never ends a strict one.
   */
  fun fire(context: Context) {
    val appContext = context.applicationContext
    try {
      val database = FocusDatabase.get(appContext)
      val now = System.currentTimeMillis()
      val due = database.getSchedules()
        .filter { it.enabled }
        .firstOrNull { schedule ->
          val occurrence = ScheduleMath.nextOccurrence(
            now - DUE_WINDOW_MILLIS,
            schedule.days,
            schedule.startMinute,
          )
          occurrence != null && occurrence <= now
        }
      if (due != null && database.getCurrentSession() == null) {
        start(database, due, now)
      }
    } catch (error: Throwable) {
      Log.w(TAG, "Could not start the scheduled session.", error)
    } finally {
      sync(appContext)
      FocusAccessibilityService.invalidateCache()
      FocusNotifier.sync(appContext)
    }
  }

  private fun start(database: FocusDatabase, schedule: StoredSchedule, now: Long) {
    val apps = database.getSelectedApps()
    if (apps.isEmpty()) {
      Log.i(TAG, "Schedule ${schedule.id} had nothing to block.")
      return
    }
    database.startSession(
      id = "schedule-" + UUID.randomUUID(),
      startTimestamp = now,
      endTimestamp = now + schedule.durationMinutes * 60_000L,
      blockedApps = apps,
      strict = schedule.strict,
    )
  }

  private fun pendingIntent(context: Context): PendingIntent? = PendingIntent.getBroadcast(
    context,
    REQUEST_CODE,
    Intent(context, BootReceiver::class.java).setAction(ACTION_SCHEDULE_DUE),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}

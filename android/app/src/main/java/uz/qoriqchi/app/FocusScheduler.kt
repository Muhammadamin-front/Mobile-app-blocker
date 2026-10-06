package uz.qoriqchi.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
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
  const val ACTION_SCHEDULE_DUE = "uz.qoriqchi.app.SCHEDULE_DUE"
  private const val REQUEST_CODE = 2001

  /**
   * How late an alarm may arrive and still start its session. Generous, because an
   * inexact alarm in Doze can be deferred by several minutes and a focus block that
   * begins late is far better than one that silently never begins.
   */
  private const val LATE_TOLERANCE_MILLIS = 20 * 60_000L

  /** Below this, what is left of the block is not worth interrupting anything for. */
  private const val MIN_REMAINDER_MILLIS = 60_000L

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
      // Exact where the app is allowed it, otherwise the Doze-aware inexact form —
      // which still fires during a maintenance window instead of being held until
      // the phone wakes up. Neither asks the user for a permission.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
      } else {
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending)
      }
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
      // If several are due, the most recent one wins: an older missed block has
      // less of itself left, and starting two at once is not a thing.
      val due = database.getSchedules()
        .filter { it.enabled }
        .mapNotNull { schedule ->
          ScheduleMath.occurrenceIfDue(
            now,
            schedule.days,
            schedule.startMinute,
            LATE_TOLERANCE_MILLIS,
          )?.let { schedule to it }
        }
        .maxByOrNull { it.second }
      if (due != null && database.getCurrentSession() == null) {
        start(database, due.first, due.second, now)
      }
    } catch (error: Throwable) {
      Log.w(TAG, "Could not start the scheduled session.", error)
    } finally {
      sync(appContext)
      FocusAccessibilityService.invalidateCache()
      FocusNotifier.sync(appContext)
    }
  }

  private fun start(
    database: FocusDatabase,
    schedule: StoredSchedule,
    dueAt: Long,
    now: Long,
  ) {
    val apps = database.getSelectedApps()
    if (apps.isEmpty()) {
      Log.i(TAG, "Schedule ${schedule.id} had nothing to block.")
      return
    }
    // The block keeps the end its owner chose. A 9-to-10 block that starts at 9:06
    // still ends at 10:00 rather than running to 10:06.
    val end = dueAt + schedule.durationMinutes * 60_000L
    if (end - now < MIN_REMAINDER_MILLIS) {
      Log.i(TAG, "Schedule ${schedule.id} fired too late to be worth starting.")
      return
    }
    database.startSession(
      id = "schedule-" + UUID.randomUUID(),
      startTimestamp = minOf(dueAt, now),
      endTimestamp = end,
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

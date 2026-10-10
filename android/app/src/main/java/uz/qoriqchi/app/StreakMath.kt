package uz.qoriqchi.app

import java.util.Calendar
import java.util.TimeZone

data class Streak(
  /** Consecutive days, ending today or yesterday, each with a qualifying session. */
  val current: Int,
  val best: Int,
  /** Today already has a qualifying session, so the streak is safe until midnight. */
  val todayDone: Boolean,
)

/**
 * The streak rule, kept free of Android so it is tested directly.
 *
 * A day counts when a session of at least [MIN_MINUTES] ran to its end with protection
 * on the whole time. A day on which protection was turned off during a session breaks
 * the chain outright, even if another session that day finished cleanly: the point of
 * the streak is that it cannot be kept by escaping and starting over. Today without a
 * session yet does not break anything; there is still time.
 */
object StreakMath {
  const val MIN_MINUTES = 15

  fun compute(qualifyingDays: Set<Long>, brokenDays: Set<Long>, today: Long): Streak {
    fun counts(day: Long) = day in qualifyingDays && day !in brokenDays

    val todayDone = counts(today)
    var current = 0
    if (today !in brokenDays) {
      var day = if (todayDone) today else today - 1
      while (counts(day)) {
        current++
        day--
      }
    }

    var best = 0
    var run = 0
    var previous: Long? = null
    for (day in qualifyingDays.filter(::counts).sorted()) {
      run = if (previous != null && day == previous + 1) run + 1 else 1
      best = maxOf(best, run)
      previous = day
    }
    return Streak(current = current, best = maxOf(best, current), todayDone = todayDone)
  }

  /** Days since the epoch in the phone's own time zone, so midnight is local midnight. */
  fun dayOf(millis: Long, zone: TimeZone = TimeZone.getDefault()): Long {
    val offset = zone.getOffset(millis)
    return Math.floorDiv(millis + offset, DAY_MILLIS)
  }

  /** The local calendar date of [day], as yyyy-MM-dd, for keys a person might read. */
  fun keyOf(day: Long): String {
    val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
      timeInMillis = day * DAY_MILLIS
    }
    return String.format(
      java.util.Locale.US,
      "%04d-%02d-%02d",
      calendar.get(Calendar.YEAR),
      calendar.get(Calendar.MONTH) + 1,
      calendar.get(Calendar.DAY_OF_MONTH),
    )
  }

  private const val DAY_MILLIS = 86_400_000L
}

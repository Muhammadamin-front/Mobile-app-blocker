package com.focusguard

import java.util.Calendar
import java.util.TimeZone

/**
 * Days are a bitmask so a schedule is one row: Monday is bit 0 through Sunday at
 * bit 6. Kept free of Android and SQLite so "when does this fire next" can be
 * tested directly instead of by waiting for a clock.
 */
object ScheduleMath {
  const val ALL_DAYS = 0b1111111
  const val WEEKDAYS = 0b0011111

  /** Monday 0 … Sunday 6, regardless of where the locale starts its week. */
  fun dayIndex(calendar: Calendar): Int = when (calendar.get(Calendar.DAY_OF_WEEK)) {
    Calendar.MONDAY -> 0
    Calendar.TUESDAY -> 1
    Calendar.WEDNESDAY -> 2
    Calendar.THURSDAY -> 3
    Calendar.FRIDAY -> 4
    Calendar.SATURDAY -> 5
    else -> 6
  }

  fun includesDay(days: Int, index: Int): Boolean = days shr index and 1 == 1

  /**
   * The next moment this schedule should start, or null when it never can. Searches
   * a full week plus today, so a schedule that only runs today later on is found
   * before one that runs tomorrow.
   */
  fun nextOccurrence(
    nowMillis: Long,
    days: Int,
    startMinute: Int,
    zone: TimeZone = TimeZone.getDefault(),
  ): Long? {
    if (days and ALL_DAYS == 0 || startMinute !in 0..1439) {
      return null
    }
    val calendar = Calendar.getInstance(zone).apply {
      timeInMillis = nowMillis
      set(Calendar.HOUR_OF_DAY, startMinute / 60)
      set(Calendar.MINUTE, startMinute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    repeat(8) {
      if (calendar.timeInMillis > nowMillis && includesDay(days, dayIndex(calendar))) {
        return calendar.timeInMillis
      }
      calendar.add(Calendar.DAY_OF_MONTH, 1)
    }
    return null
  }

  /** The soonest start across several schedules, ignoring the ones that never fire. */
  fun earliest(occurrences: List<Long?>): Long? =
    occurrences.filterNotNull().minOrNull()
}

package com.focusguard

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScheduleMathTest {
  private val utc = TimeZone.getTimeZone("UTC")

  private fun at(year: Int, month: Int, day: Int, hour: Int, minute: Int = 0): Long =
    Calendar.getInstance(utc).apply {
      clear()
      set(year, month - 1, day, hour, minute, 0)
    }.timeInMillis

  // 2026-09-21 is a Monday.
  @Test
  fun firesLaterTheSameDayWhenTheTimeHasNotPassed() {
    val next = ScheduleMath.nextOccurrence(at(2026, 9, 21, 8), ScheduleMath.WEEKDAYS, 9 * 60, utc)
    assertEquals(at(2026, 9, 21, 9), next)
  }

  @Test
  fun rollsToTheNextMatchingDayOnceTheTimeHasPassed() {
    val next = ScheduleMath.nextOccurrence(at(2026, 9, 21, 10), ScheduleMath.WEEKDAYS, 9 * 60, utc)
    assertEquals(at(2026, 9, 22, 9), next)
  }

  @Test
  fun skipsTheWeekendForAWeekdaySchedule() {
    val next = ScheduleMath.nextOccurrence(at(2026, 9, 25, 20), ScheduleMath.WEEKDAYS, 9 * 60, utc)
    assertEquals(at(2026, 9, 28, 9), next)
  }

  @Test
  fun aSingleDayScheduleWrapsAWholeWeek() {
    val sundayOnly = 1 shl 6
    val next = ScheduleMath.nextOccurrence(at(2026, 9, 21, 12), sundayOnly, 7 * 60, utc)
    assertEquals(at(2026, 9, 27, 7), next)
  }

  @Test
  fun aScheduleWithNoDaysNeverFires() {
    assertNull(ScheduleMath.nextOccurrence(at(2026, 9, 21, 8), 0, 9 * 60, utc))
  }

  @Test
  fun refusesAMinuteOutsideTheDay() {
    assertNull(ScheduleMath.nextOccurrence(at(2026, 9, 21, 8), ScheduleMath.ALL_DAYS, -1, utc))
    assertNull(ScheduleMath.nextOccurrence(at(2026, 9, 21, 8), ScheduleMath.ALL_DAYS, 1440, utc))
  }

  @Test
  fun exactlyNowCountsAsPassedSoAScheduleNeverFiresTwice() {
    val nine = at(2026, 9, 21, 9)
    val next = ScheduleMath.nextOccurrence(nine, ScheduleMath.ALL_DAYS, 9 * 60, utc)
    assertTrue("expected tomorrow, got $next", next!! > nine)
    assertEquals(at(2026, 9, 22, 9), next)
  }

  @Test
  fun theSoonestScheduleWins() {
    assertEquals(100L, ScheduleMath.earliest(listOf(500L, null, 100L, 900L)))
    assertNull(ScheduleMath.earliest(listOf(null, null)))
  }
}

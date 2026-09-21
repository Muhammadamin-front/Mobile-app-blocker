package com.focusguard

import java.util.Calendar
import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FocusTrendMathTest {
  private val utc = TimeZone.getTimeZone("UTC")

  private fun at(year: Int, month: Int, day: Int, hour: Int = 0, minute: Int = 0): Long =
    Calendar.getInstance(utc).apply {
      clear()
      set(year, month - 1, day, hour, minute, 0)
    }.timeInMillis

  @Test
  fun weekHasSevenDailyBucketsEndingToday() {
    val edges = FocusTrendMath.edges(at(2026, 9, 21, 15), FocusTrendMath.RANGE_WEEK, utc)
    assertEquals(8, edges.size)
    assertEquals(at(2026, 9, 15), edges.first())
    assertEquals(at(2026, 9, 22), edges.last())
  }

  @Test
  fun yearHasTwelveMonthlyBucketsAcrossTheYearBoundary() {
    val edges = FocusTrendMath.edges(at(2026, 2, 14), FocusTrendMath.RANGE_YEAR, utc)
    assertEquals(13, edges.size)
    assertEquals(at(2025, 3, 1), edges.first())
    assertEquals(at(2026, 3, 1), edges.last())
  }

  @Test
  fun aSessionCrossingMidnightIsSplitAcrossBothDays() {
    val edges = FocusTrendMath.edges(at(2026, 9, 21, 12), FocusTrendMath.RANGE_WEEK, utc)
    val span = FocusSpan(at(2026, 9, 20, 23), at(2026, 9, 21, 1))
    val totals = FocusTrendMath.distribute(listOf(span), edges)
    assertEquals(7, totals.size)
    assertEquals(3_600_000L, totals[5])
    assertEquals(3_600_000L, totals[6])
  }

  @Test
  fun timeOutsideTheWindowIsNotCounted() {
    val edges = FocusTrendMath.edges(at(2026, 9, 21, 12), FocusTrendMath.RANGE_WEEK, utc)
    val old = FocusSpan(at(2026, 9, 1), at(2026, 9, 1, 2))
    assertEquals(0L, FocusTrendMath.distribute(listOf(old), edges).sum())
  }

  @Test
  fun onlySessionsThatProtectedTimeAreMeasured() {
    val now = at(2026, 9, 21, 12)
    val start = at(2026, 9, 21, 10)
    val plannedEnd = at(2026, 9, 21, 14)

    assertNull(FocusTrendMath.spanOf("SCHEDULED", start, plannedEnd, null, now))
    assertNull(FocusTrendMath.spanOf("STOPPED", start, plannedEnd, null, now))
    assertEquals(
      FocusSpan(start, now),
      FocusTrendMath.spanOf("ACTIVE", start, plannedEnd, null, now),
    )
    assertEquals(
      FocusSpan(start, at(2026, 9, 21, 11)),
      FocusTrendMath.spanOf("STOPPED", start, plannedEnd, at(2026, 9, 21, 11), now),
    )
    assertEquals(
      FocusSpan(start, plannedEnd),
      FocusTrendMath.spanOf("COMPLETED", start, plannedEnd, plannedEnd, now),
    )
  }

  @Test
  fun anUnknownRangeFallsBackToTheWeek() {
    assertEquals(FocusTrendMath.RANGE_WEEK, FocusTrendMath.normalizeRange(null))
    assertEquals(FocusTrendMath.RANGE_WEEK, FocusTrendMath.normalizeRange("decade"))
    assertEquals(FocusTrendMath.RANGE_YEAR, FocusTrendMath.normalizeRange("year"))
  }
}

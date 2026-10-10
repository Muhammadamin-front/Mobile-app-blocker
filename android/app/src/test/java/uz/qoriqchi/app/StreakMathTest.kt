package uz.qoriqchi.app

import java.util.TimeZone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StreakMathTest {
  private val today = 20_000L

  private fun days(vararg offsets: Int) = offsets.map { today - it }.toSet()

  @Test
  fun noSessionsMeansNoStreak() {
    val streak = StreakMath.compute(emptySet(), emptySet(), today)
    assertEquals(0, streak.current)
    assertEquals(0, streak.best)
    assertFalse(streak.todayDone)
  }

  @Test
  fun consecutiveDaysEndingTodayCount() {
    val streak = StreakMath.compute(days(0, 1, 2), emptySet(), today)
    assertEquals(3, streak.current)
    assertTrue(streak.todayDone)
  }

  @Test
  fun todayWithoutASessionYetDoesNotBreakIt() {
    val streak = StreakMath.compute(days(1, 2, 3), emptySet(), today)
    assertEquals(3, streak.current)
    assertFalse(streak.todayDone)
  }

  @Test
  fun aMissedDayEndsTheCurrentStreakButNotTheBest() {
    val streak = StreakMath.compute(days(2, 3, 4, 5), emptySet(), today)
    assertEquals(0, streak.current)
    assertEquals(4, streak.best)
  }

  @Test
  fun breakingASessionTodayResetsEvenWithACleanOneBesideIt() {
    val streak = StreakMath.compute(days(0, 1, 2), days(0), today)
    assertEquals(0, streak.current)
    assertFalse(streak.todayDone)
    assertEquals(2, streak.best)
  }

  @Test
  fun aBrokenDayInThePastSplitsTheRun() {
    val streak = StreakMath.compute(days(0, 1, 2, 3, 4), days(2), today)
    assertEquals(2, streak.current)
    assertEquals(2, streak.best)
  }

  @Test
  fun dayOfFollowsLocalMidnightNotUtc() {
    val tashkent = TimeZone.getTimeZone("Asia/Tashkent") // UTC+5, no daylight saving
    // 2026-10-09 20:30 UTC is already 01:30 on the 10th in Tashkent.
    val lateEvening = 1_791_577_800_000L
    assertEquals(
      StreakMath.dayOf(lateEvening, TimeZone.getTimeZone("UTC")) + 1,
      StreakMath.dayOf(lateEvening, tashkent),
    )
    assertEquals("2026-10-10", StreakMath.keyOf(StreakMath.dayOf(lateEvening, tashkent)))
  }
}

package uz.qoriqchi.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ExamCountdownTest {
  private val oct10 = ExamCountdown.dayOfDate("2026-10-10")!!

  @Test
  fun countsWholeCalendarDays() {
    assertEquals(0L, ExamCountdown.daysUntil("2026-10-10", oct10))
    assertEquals(1L, ExamCountdown.daysUntil("2026-10-11", oct10))
    assertEquals(83L, ExamCountdown.daysUntil("2027-01-01", oct10))
  }

  @Test
  fun aPassedExamIsNegative() {
    assertEquals(-9L, ExamCountdown.daysUntil("2026-10-01", oct10))
  }

  @Test
  fun anImpossibleOrMalformedDateIsRefused() {
    assertNull(ExamCountdown.dayOfDate("2026-02-30"))
    assertNull(ExamCountdown.dayOfDate("10/11/2026"))
    assertNull(ExamCountdown.daysUntil("", oct10))
  }

  @Test
  fun matchesTheKeysTheStreakUses() {
    assertEquals("2026-10-10", StreakMath.keyOf(oct10))
  }
}

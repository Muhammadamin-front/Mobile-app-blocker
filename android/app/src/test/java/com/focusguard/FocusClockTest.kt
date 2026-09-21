package com.focusguard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusClockTest {
  @Test
  fun sameBootUsesElapsedTimeDespiteWallClockChanges() {
    assertFalse(
      FocusClock.isExpired(
        nowWall = 999_999L,
        nowElapsed = 15_000L,
        endWall = 20_000L,
        startElapsed = 10_000L,
        durationMillis = 10_000L,
        sessionBootCount = 4,
        currentBootCount = 4,
      ),
    )
    assertEquals(
      5_000L,
      FocusClock.remainingMillis(999_999L, 15_000L, 20_000L, 10_000L, 10_000L, 4, 4),
    )
  }

  @Test
  fun rebootFallsBackToWallClock() {
    assertTrue(FocusClock.isExpired(21_000L, 1_000L, 20_000L, 10_000L, 10_000L, 4, 5))
    assertEquals(4_000L, FocusClock.startsInMillis(6_000L, 900L, 10_000L, 50_000L, 4, 5))
  }

  @Test
  fun unavailableBootCountersNeverPretendToBeSameBoot() {
    assertFalse(FocusClock.isSameBoot(-1, -1))
    assertTrue(FocusClock.hasStarted(11_000L, 1L, 10_000L, 50_000L, -1, -1))
  }

  @Test
  fun snapshotIsNeverTrustedPastTheSessionEnd() {
    assertEquals(4_000L, FocusClock.cacheWindowMillis(10_000L, 4_000L))
    assertEquals(1_200L, FocusClock.cacheWindowMillis(1_200L, 4_000L))
    assertEquals(0L, FocusClock.cacheWindowMillis(-500L, 4_000L))
  }
}

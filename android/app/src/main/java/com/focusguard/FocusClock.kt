package com.focusguard

object FocusClock {
  fun isSameBoot(sessionBootCount: Int, currentBootCount: Int): Boolean =
    sessionBootCount >= 0 && currentBootCount >= 0 && sessionBootCount == currentBootCount

  fun hasStarted(
    nowWall: Long,
    nowElapsed: Long,
    startWall: Long,
    startElapsed: Long,
    sessionBootCount: Int,
    currentBootCount: Int,
  ): Boolean = if (isSameBoot(sessionBootCount, currentBootCount)) {
    nowElapsed >= startElapsed
  } else {
    nowWall >= startWall
  }

  fun isExpired(
    nowWall: Long,
    nowElapsed: Long,
    endWall: Long,
    startElapsed: Long,
    durationMillis: Long,
    sessionBootCount: Int,
    currentBootCount: Int,
  ): Boolean = if (isSameBoot(sessionBootCount, currentBootCount)) {
    nowElapsed >= startElapsed + durationMillis
  } else {
    nowWall >= endWall
  }

  fun remainingMillis(
    nowWall: Long,
    nowElapsed: Long,
    endWall: Long,
    startElapsed: Long,
    durationMillis: Long,
    sessionBootCount: Int,
    currentBootCount: Int,
  ): Long = if (isSameBoot(sessionBootCount, currentBootCount)) {
    startElapsed + durationMillis - nowElapsed
  } else {
    endWall - nowWall
  }.coerceAtLeast(0L)

  fun startsInMillis(
    nowWall: Long,
    nowElapsed: Long,
    startWall: Long,
    startElapsed: Long,
    sessionBootCount: Int,
    currentBootCount: Int,
  ): Long = if (isSameBoot(sessionBootCount, currentBootCount)) {
    startElapsed - nowElapsed
  } else {
    startWall - nowWall
  }.coerceAtLeast(0L)
}

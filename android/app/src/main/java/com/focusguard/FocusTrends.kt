package com.focusguard

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

data class FocusBucket(val label: String, val startTimestamp: Long, val focusMillis: Long)

data class AppAttempt(val packageName: String, val appName: String, val attempts: Int)

/** A finished or in-flight stretch of focus, already resolved to wall-clock bounds. */
data class FocusSpan(val startTimestamp: Long, val endTimestamp: Long)

data class FocusTrends(
  val range: String,
  val buckets: List<FocusBucket>,
  val windowStart: Long,
  val totalFocusMillis: Long,
  val completedSessions: Int,
  val blockedAttempts: Int,
  val topApps: List<AppAttempt>,
)

/**
 * Bucketing is kept free of Android and SQLite so the arithmetic that decides what a
 * chart shows can be tested directly. A session is split across the days or months it
 * actually covers rather than being credited entirely to the day it began.
 */
object FocusTrendMath {
  const val RANGE_WEEK = "week"
  const val RANGE_MONTH = "month"
  const val RANGE_YEAR = "year"

  fun normalizeRange(raw: String?): String = when (raw) {
    RANGE_MONTH -> RANGE_MONTH
    RANGE_YEAR -> RANGE_YEAR
    else -> RANGE_WEEK
  }

  fun bucketCount(range: String): Int = when (range) {
    RANGE_MONTH -> 30
    RANGE_YEAR -> 12
    else -> 7
  }

  /**
   * Bucket edges in local time, oldest first, with one extra edge closing the last
   * bucket. Computed from the zone at call time so a flight across time zones moves
   * the boundaries with the user rather than leaving the chart on the old offset.
   */
  fun edges(nowMillis: Long, range: String, zone: TimeZone = TimeZone.getDefault()): List<Long> {
    val calendar = Calendar.getInstance(zone).apply { timeInMillis = nowMillis }
    calendar.set(Calendar.HOUR_OF_DAY, 0)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    val count = bucketCount(range)
    if (range == RANGE_YEAR) {
      calendar.set(Calendar.DAY_OF_MONTH, 1)
      calendar.add(Calendar.MONTH, -(count - 1))
    } else {
      calendar.add(Calendar.DAY_OF_MONTH, -(count - 1))
    }
    return buildList {
      repeat(count + 1) {
        add(calendar.timeInMillis)
        if (range == RANGE_YEAR) {
          calendar.add(Calendar.MONTH, 1)
        } else {
          calendar.add(Calendar.DAY_OF_MONTH, 1)
        }
      }
    }
  }

  fun label(startMillis: Long, range: String, zone: TimeZone = TimeZone.getDefault()): String {
    val pattern = when (range) {
      RANGE_YEAR -> "LLL"
      RANGE_MONTH -> "d"
      else -> "EEE"
    }
    return SimpleDateFormat(pattern, Locale.getDefault()).apply { timeZone = zone }
      .format(startMillis)
  }

  /** Splits every span across the buckets it overlaps; returns one total per bucket. */
  fun distribute(spans: List<FocusSpan>, edges: List<Long>): List<Long> {
    if (edges.size < 2) {
      return emptyList()
    }
    val totals = LongArray(edges.size - 1)
    spans.forEach { span ->
      val start = span.startTimestamp
      val end = span.endTimestamp
      if (end <= start) {
        return@forEach
      }
      for (index in totals.indices) {
        val bucketStart = edges[index]
        val bucketEnd = edges[index + 1]
        if (end <= bucketStart) {
          break
        }
        if (start >= bucketEnd) {
          continue
        }
        val overlap = minOf(end, bucketEnd) - maxOf(start, bucketStart)
        if (overlap > 0L) {
          totals[index] += overlap
        }
      }
    }
    return totals.toList()
  }

  /**
   * The stretch a session actually protected. A scheduled session has not protected
   * anything yet, and a stopped session that predates end tracking cannot be measured,
   * so neither is counted rather than guessed at.
   */
  fun spanOf(
    status: String,
    startTimestamp: Long,
    endTimestamp: Long,
    endedAt: Long?,
    nowMillis: Long,
  ): FocusSpan? {
    val end = when (status) {
      "COMPLETED" -> endedAt ?: endTimestamp
      "STOPPED" -> endedAt ?: return null
      "ACTIVE" -> minOf(nowMillis, endTimestamp)
      else -> return null
    }
    return if (end > startTimestamp) FocusSpan(startTimestamp, minOf(end, endTimestamp)) else null
  }
}

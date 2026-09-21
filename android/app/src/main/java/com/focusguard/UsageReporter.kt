package com.focusguard

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process

data class ScreenTimeApp(
  val packageName: String,
  val appName: String,
  val usageMillis: Long,
)

data class ScreenTimeReport(
  val available: Boolean,
  val windowStart: Long,
  val totalMillis: Long,
  val apps: List<ScreenTimeApp>,
)

/**
 * Reads Android's own usage statistics. Everything here is optional: the permission
 * is granted by hand in Settings, can be withdrawn at any time, and blocking works
 * exactly the same without it. Nothing read here leaves the device.
 */
class UsageReporter(private val context: Context) {

  fun hasAccess(): Boolean {
    val appOps = context.getSystemService(AppOpsManager::class.java) ?: return false
    val mode = try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      }
    } catch (_: Exception) {
      return false
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /**
   * Foreground time per app for the same window the focus chart uses. Android keeps
   * less detail the further back the window reaches, so a long range is the best the
   * system can still account for rather than a guarantee.
   */
  fun report(rawRange: String?, limit: Int = 5): ScreenTimeReport {
    val range = FocusTrendMath.normalizeRange(rawRange)
    val edges = FocusTrendMath.edges(System.currentTimeMillis(), range)
    val windowStart = edges.first()
    val windowEnd = System.currentTimeMillis()

    if (!hasAccess()) {
      return ScreenTimeReport(false, windowStart, 0L, emptyList())
    }

    val manager = context.getSystemService(UsageStatsManager::class.java)
      ?: return ScreenTimeReport(false, windowStart, 0L, emptyList())

    val aggregated = try {
      manager.queryAndAggregateUsageStats(windowStart, windowEnd)
    } catch (_: Exception) {
      return ScreenTimeReport(false, windowStart, 0L, emptyList())
    }

    val packageManager = context.packageManager
    val entries = aggregated.values
      .asSequence()
      .filter { it.totalTimeInForeground > 0L }
      // Our own screen counts as time spent reading the report, not as a distraction.
      .filter { it.packageName != context.packageName }
      .filter { packageManager.getLaunchIntentForPackage(it.packageName) != null }
      .map { stats ->
        val label = try {
          packageManager.getApplicationLabel(
            packageManager.getApplicationInfo(stats.packageName, 0),
          ).toString()
        } catch (_: Exception) {
          stats.packageName
        }
        ScreenTimeApp(stats.packageName, label.ifBlank { stats.packageName }, stats.totalTimeInForeground)
      }
      .sortedByDescending { it.usageMillis }
      .toList()

    return ScreenTimeReport(
      available = true,
      windowStart = windowStart,
      totalMillis = entries.sumOf { it.usageMillis },
      apps = entries.take(limit),
    )
  }
}

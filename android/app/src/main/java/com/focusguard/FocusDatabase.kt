package com.focusguard

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

data class StoredApp(
  val packageName: String,
  val appName: String,
  val iconBase64: String? = null,
)

data class StoredSession(
  val id: String,
  val startTimestamp: Long,
  val endTimestamp: Long,
  val startElapsed: Long,
  val durationMillis: Long,
  val bootCount: Int,
  val blockedApps: List<StoredApp>,
  val status: String,
  val completedReason: String?,
  val blockedAttempts: Int,
)

class FocusDatabase private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, DATABASE_NAME, null, DATABASE_VERSION) {

  private val appContext = context.applicationContext

  override fun onConfigure(db: SQLiteDatabase) {
    super.onConfigure(db)
    db.setForeignKeyConstraintsEnabled(true)
    db.enableWriteAheadLogging()
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        start_timestamp INTEGER NOT NULL,
        end_timestamp INTEGER NOT NULL,
        start_elapsed INTEGER NOT NULL,
        duration_millis INTEGER NOT NULL,
        boot_count INTEGER NOT NULL,
        blocked_apps TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_reason TEXT,
        created_at INTEGER NOT NULL
      )""",
    )
    db.execSQL(
      """CREATE TABLE block_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        package_name TEXT NOT NULL,
        app_name TEXT NOT NULL,
        attempted_at INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )""",
    )
    db.execSQL("CREATE INDEX idx_sessions_status ON sessions(status)")
    db.execSQL("CREATE INDEX idx_attempts_session ON block_attempts(session_id)")
    db.execSQL(
      """CREATE TABLE settings (
        setting_key TEXT PRIMARY KEY NOT NULL,
        setting_value TEXT NOT NULL
      )""",
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  @Synchronized
  fun startSession(
    id: String,
    startTimestamp: Long,
    endTimestamp: Long,
    blockedApps: List<StoredApp>,
  ): StoredSession {
    require(id.isNotBlank()) { "Session id is required." }
    require(blockedApps.isNotEmpty()) { "Choose at least one app." }
    require(endTimestamp > startTimestamp) { "The end time must be after the start time." }
    require(endTimestamp > System.currentTimeMillis()) { "The focus session must end in the future." }

    normalizeSessions()
    readableDatabase.rawQuery(
      "SELECT COUNT(*) FROM sessions WHERE status IN ('ACTIVE', 'SCHEDULED')",
      null,
    ).use { cursor ->
      if (cursor.moveToFirst() && cursor.getInt(0) > 0) {
        throw IllegalStateException("A focus session is already running.")
      }
    }

    val nowWall = System.currentTimeMillis()
    val nowElapsed = SystemClock.elapsedRealtime()
    val startElapsed = nowElapsed + (startTimestamp - nowWall).coerceAtLeast(0L)
    val status = if (startTimestamp > nowWall) "SCHEDULED" else "ACTIVE"
    val values = ContentValues().apply {
      put("id", id)
      put("start_timestamp", startTimestamp)
      put("end_timestamp", endTimestamp)
      put("start_elapsed", startElapsed)
      put("duration_millis", endTimestamp - startTimestamp)
      put("boot_count", currentBootCount())
      put("blocked_apps", appsToJson(blockedApps.map { it.copy(iconBase64 = null) }))
      put("status", status)
      put("created_at", nowWall)
    }
    writableDatabase.insertOrThrow("sessions", null, values)
    return getCurrentSession() ?: error("The session could not be restored after saving.")
  }

  @Synchronized
  fun stopSession(): StoredSession? {
    val current = getCurrentSession() ?: return null
    val values = ContentValues().apply {
      put("status", "STOPPED")
      put("completed_reason", "user")
    }
    writableDatabase.update("sessions", values, "id = ?", arrayOf(current.id))
    return getSession(current.id)
  }

  @Synchronized
  fun getCurrentSession(): StoredSession? {
    normalizeSessions()
    return readableDatabase.rawQuery(
      """SELECT s.*, (SELECT COUNT(*) FROM block_attempts a WHERE a.session_id = s.id) AS attempts
         FROM sessions s WHERE status IN ('ACTIVE', 'SCHEDULED')
         ORDER BY created_at DESC LIMIT 1""",
      null,
    ).use { cursor -> if (cursor.moveToFirst()) sessionFromCursor(cursor) else null }
  }

  @Synchronized
  fun getEnforceableSession(): StoredSession? {
    val current = getCurrentSession() ?: return null
    val hasStarted = FocusClock.hasStarted(
      nowWall = System.currentTimeMillis(),
      nowElapsed = SystemClock.elapsedRealtime(),
      startWall = current.startTimestamp,
      startElapsed = current.startElapsed,
      sessionBootCount = current.bootCount,
      currentBootCount = currentBootCount(),
    )
    return if (hasStarted && current.status == "ACTIVE") current else null
  }

  fun remainingMillis(session: StoredSession): Long = FocusClock.remainingMillis(
    nowWall = System.currentTimeMillis(),
    nowElapsed = SystemClock.elapsedRealtime(),
    endWall = session.endTimestamp,
    startElapsed = session.startElapsed,
    durationMillis = session.durationMillis,
    sessionBootCount = session.bootCount,
    currentBootCount = currentBootCount(),
  )

  fun startsInMillis(session: StoredSession): Long = FocusClock.startsInMillis(
    nowWall = System.currentTimeMillis(),
    nowElapsed = SystemClock.elapsedRealtime(),
    startWall = session.startTimestamp,
    startElapsed = session.startElapsed,
    sessionBootCount = session.bootCount,
    currentBootCount = currentBootCount(),
  )

  @Synchronized
  fun normalizeSessions() {
    val nowWall = System.currentTimeMillis()
    val nowElapsed = SystemClock.elapsedRealtime()
    val boot = currentBootCount()
    val db = writableDatabase
    db.rawQuery(
      "SELECT id, start_timestamp, end_timestamp, start_elapsed, duration_millis, boot_count, status FROM sessions WHERE status IN ('ACTIVE', 'SCHEDULED')",
      null,
    ).use { cursor ->
      while (cursor.moveToNext()) {
        val id = cursor.getString(0)
        val startWall = cursor.getLong(1)
        val endWall = cursor.getLong(2)
        val startElapsed = cursor.getLong(3)
        val duration = cursor.getLong(4)
        val sessionBoot = cursor.getInt(5)
        val oldStatus = cursor.getString(6)
        val started = FocusClock.hasStarted(nowWall, nowElapsed, startWall, startElapsed, sessionBoot, boot)
        val expired = FocusClock.isExpired(nowWall, nowElapsed, endWall, startElapsed, duration, sessionBoot, boot)
        val nextStatus = when {
          expired -> "COMPLETED"
          started -> "ACTIVE"
          else -> "SCHEDULED"
        }
        if (nextStatus != oldStatus) {
          val values = ContentValues().apply {
            put("status", nextStatus)
            if (nextStatus == "COMPLETED") put("completed_reason", "expired")
          }
          db.update("sessions", values, "id = ?", arrayOf(id))
        }
      }
    }
  }

  @Synchronized
  fun recordAttempt(session: StoredSession, blockedApp: StoredApp) {
    val values = ContentValues().apply {
      put("session_id", session.id)
      put("package_name", blockedApp.packageName)
      put("app_name", blockedApp.appName)
      put("attempted_at", System.currentTimeMillis())
    }
    writableDatabase.insert("block_attempts", null, values)
  }

  @Synchronized
  fun getHistory(): List<StoredSession> {
    normalizeSessions()
    return readableDatabase.rawQuery(
      """SELECT s.*, (SELECT COUNT(*) FROM block_attempts a WHERE a.session_id = s.id) AS attempts
         FROM sessions s WHERE status IN ('COMPLETED', 'STOPPED')
         ORDER BY created_at DESC LIMIT 250""",
      null,
    ).use { cursor ->
      buildList { while (cursor.moveToNext()) add(sessionFromCursor(cursor)) }
    }
  }

  @Synchronized
  fun getSession(id: String): StoredSession? = readableDatabase.rawQuery(
    """SELECT s.*, (SELECT COUNT(*) FROM block_attempts a WHERE a.session_id = s.id) AS attempts
       FROM sessions s WHERE id = ? LIMIT 1""",
    arrayOf(id),
  ).use { cursor -> if (cursor.moveToFirst()) sessionFromCursor(cursor) else null }

  @Synchronized
  fun getStatistics(): Map<String, Any> {
    normalizeSessions()
    var completedSessions = 0
    var totalFocusMillis = 0L
    readableDatabase.rawQuery(
      "SELECT COUNT(*), COALESCE(SUM(duration_millis), 0) FROM sessions WHERE status = 'COMPLETED'",
      null,
    ).use { cursor ->
      if (cursor.moveToFirst()) {
        completedSessions = cursor.getInt(0)
        totalFocusMillis = cursor.getLong(1)
      }
    }
    val attempts = mutableListOf<Map<String, Any>>()
    var totalAttempts = 0
    readableDatabase.rawQuery(
      """SELECT package_name, MAX(app_name), COUNT(*) AS count
         FROM block_attempts GROUP BY package_name ORDER BY count DESC""",
      null,
    ).use { cursor ->
      while (cursor.moveToNext()) {
        val count = cursor.getInt(2)
        totalAttempts += count
        attempts += mapOf(
          "packageName" to cursor.getString(0),
          "appName" to cursor.getString(1),
          "attempts" to count,
        )
      }
    }
    return mapOf(
      "completedSessions" to completedSessions,
      "totalFocusMillis" to totalFocusMillis,
      "totalBlockedAttempts" to totalAttempts,
      "attemptsByPackage" to attempts,
    )
  }

  @Synchronized
  fun setSelectedApps(apps: List<StoredApp>) = setSetting(SELECTED_APPS, appsToJson(apps))

  @Synchronized
  fun getSelectedApps(): List<StoredApp> = appsFromJson(getSetting(SELECTED_APPS) ?: "[]")

  @Synchronized
  fun setSetting(key: String, value: String) {
    val values = ContentValues().apply {
      put("setting_key", key)
      put("setting_value", value)
    }
    writableDatabase.insertWithOnConflict("settings", null, values, SQLiteDatabase.CONFLICT_REPLACE)
  }

  @Synchronized
  fun getSetting(key: String): String? = readableDatabase.rawQuery(
    "SELECT setting_value FROM settings WHERE setting_key = ?",
    arrayOf(key),
  ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

  @Synchronized
  fun resetAllData() {
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.delete("block_attempts", null, null)
      db.delete("sessions", null, null)
      db.delete("settings", null, null)
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  private fun sessionFromCursor(cursor: android.database.Cursor): StoredSession = StoredSession(
    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
    startTimestamp = cursor.getLong(cursor.getColumnIndexOrThrow("start_timestamp")),
    endTimestamp = cursor.getLong(cursor.getColumnIndexOrThrow("end_timestamp")),
    startElapsed = cursor.getLong(cursor.getColumnIndexOrThrow("start_elapsed")),
    durationMillis = cursor.getLong(cursor.getColumnIndexOrThrow("duration_millis")),
    bootCount = cursor.getInt(cursor.getColumnIndexOrThrow("boot_count")),
    blockedApps = appsFromJson(cursor.getString(cursor.getColumnIndexOrThrow("blocked_apps"))),
    status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
    completedReason = cursor.getString(cursor.getColumnIndexOrThrow("completed_reason")),
    blockedAttempts = cursor.getInt(cursor.getColumnIndexOrThrow("attempts")),
  )

  private fun currentBootCount(): Int = try {
    Settings.Global.getInt(appContext.contentResolver, Settings.Global.BOOT_COUNT)
  } catch (_: Exception) {
    -1
  }

  companion object {
    private const val DATABASE_NAME = "focus_guard.db"
    private const val DATABASE_VERSION = 1
    const val SELECTED_APPS = "selected_apps"
    const val ONBOARDING_COMPLETED = "onboarding_completed"
    const val THEME_PREFERENCE = "theme_preference"

    @Volatile private var instance: FocusDatabase? = null

    fun get(context: Context): FocusDatabase = instance ?: synchronized(this) {
      instance ?: FocusDatabase(context).also { instance = it }
    }

    private fun appsToJson(apps: List<StoredApp>): String = JSONArray().apply {
      apps.distinctBy { it.packageName }.forEach { app ->
        put(JSONObject().apply {
          put("packageName", app.packageName)
          put("appName", app.appName)
          if (app.iconBase64 != null) put("iconBase64", app.iconBase64)
        })
      }
    }.toString()

    private fun appsFromJson(raw: String): List<StoredApp> = try {
      val json = JSONArray(raw)
      buildList {
        for (index in 0 until json.length()) {
          val value = json.getJSONObject(index)
          val packageName = value.optString("packageName")
          if (packageName.isNotBlank()) {
            add(StoredApp(packageName, value.optString("appName", packageName), value.optString("iconBase64").ifBlank { null }))
          }
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }
}

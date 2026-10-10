package uz.qoriqchi.app

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

data class StoredSchedule(
  val id: String,
  val label: String,
  /** Monday is bit 0 through Sunday at bit 6. */
  val days: Int,
  val startMinute: Int,
  val durationMinutes: Int,
  val strict: Boolean,
  val enabled: Boolean,
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
  val strict: Boolean,
  /** When protection was found off during this session; it no longer counts toward a streak. */
  val brokenAt: Long? = null,
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
        ended_at INTEGER,
        strict INTEGER NOT NULL DEFAULT 0,
        broken_at INTEGER,
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
      """CREATE TABLE schedules (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        days INTEGER NOT NULL,
        start_minute INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        strict INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )""",
    )
    db.execSQL(
      """CREATE TABLE settings (
        setting_key TEXT PRIMARY KEY NOT NULL,
        setting_value TEXT NOT NULL
      )""",
    )
    createProgressTables(db)
  }

  /** Per-day reading and word counts, and where each English word stands in review. */
  private fun createProgressTables(db: SQLiteDatabase) {
    db.execSQL(
      """CREATE TABLE daily_progress (
        day TEXT PRIMARY KEY NOT NULL,
        pages INTEGER NOT NULL DEFAULT 0,
        words INTEGER NOT NULL DEFAULT 0
      )""",
    )
    db.execSQL(
      """CREATE TABLE word_progress (
        word TEXT PRIMARY KEY NOT NULL,
        box INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        reviews INTEGER NOT NULL DEFAULT 0
      )""",
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) {
      // ended_at records when a session actually stopped protecting time, which the
      // statistics need; completed rows can be backfilled from their planned end.
      db.execSQL("ALTER TABLE sessions ADD COLUMN ended_at INTEGER")
      db.execSQL("UPDATE sessions SET ended_at = end_timestamp WHERE status = 'COMPLETED'")
    }
    if (oldVersion < 3) {
      // A strict session refuses to be ended early; older rows were all ordinary.
      db.execSQL("ALTER TABLE sessions ADD COLUMN strict INTEGER NOT NULL DEFAULT 0")
    }
    if (oldVersion < 4) {
      db.execSQL(
        """CREATE TABLE schedules (
          id TEXT PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          days INTEGER NOT NULL,
          start_minute INTEGER NOT NULL,
          duration_minutes INTEGER NOT NULL,
          strict INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        )""",
      )
    }
    if (oldVersion < 5) {
      // Sessions before this version were never checked for protection being turned
      // off, so they stay unbroken rather than being judged after the fact.
      db.execSQL("ALTER TABLE sessions ADD COLUMN broken_at INTEGER")
      createProgressTables(db)
    }
  }

  @Synchronized
  fun startSession(
    id: String,
    startTimestamp: Long,
    endTimestamp: Long,
    blockedApps: List<StoredApp>,
    strict: Boolean,
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
      put("strict", if (strict) 1 else 0)
      put("created_at", nowWall)
    }
    writableDatabase.insertOrThrow("sessions", null, values)
    return getCurrentSession() ?: error("The session could not be restored after saving.")
  }

  @Synchronized
  fun stopSession(): StoredSession? {
    val current = getCurrentSession() ?: return null
    // The whole point of a strict session is that this call does not work.
    check(!current.strict || remainingMillis(current) <= 0L) {
      "This is a strict session. It cannot be ended before it finishes."
    }
    val values = ContentValues().apply {
      put("status", "STOPPED")
      put("completed_reason", "user")
      put("ended_at", System.currentTimeMillis())
    }
    writableDatabase.update("sessions", values, "id = ?", arrayOf(current.id))
    return getSession(current.id)
  }

  /**
   * Records that protection was off while this session ran. The first time is the one
   * that counts; the session itself carries on and blocks again if protection returns.
   */
  @Synchronized
  fun markBroken(id: String, at: Long = System.currentTimeMillis()): Boolean {
    val values = ContentValues().apply { put("broken_at", at) }
    return writableDatabase.update("sessions", values, "id = ? AND broken_at IS NULL", arrayOf(id)) > 0
  }

  @Synchronized
  fun getStreak(nowMillis: Long = System.currentTimeMillis()): Streak {
    normalizeSessions()
    val qualifying = mutableSetOf<Long>()
    val broken = mutableSetOf<Long>()
    readableDatabase.rawQuery(
      "SELECT status, end_timestamp, duration_millis, broken_at FROM sessions WHERE status IN ('COMPLETED', 'STOPPED', 'ACTIVE')",
      null,
    ).use { cursor ->
      while (cursor.moveToNext()) {
        if (!cursor.isNull(3)) {
          broken += StreakMath.dayOf(cursor.getLong(3))
        } else if (
          cursor.getString(0) == "COMPLETED" &&
          cursor.getLong(2) >= StreakMath.MIN_MINUTES * 60_000L
        ) {
          qualifying += StreakMath.dayOf(cursor.getLong(1))
        }
      }
    }
    return StreakMath.compute(qualifying, broken, StreakMath.dayOf(nowMillis))
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
            if (nextStatus == "COMPLETED") {
              put("completed_reason", "expired")
              put("ended_at", minOf(endWall, nowWall))
            }
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
    readableDatabase.rawQuery(
      "SELECT COUNT(*) FROM sessions WHERE status = 'COMPLETED'",
      null,
    ).use { cursor -> if (cursor.moveToFirst()) completedSessions = cursor.getInt(0) }

    // Measured the same way the trends are, so the all-time figure can never
    // contradict the window shown right above it.
    val now = System.currentTimeMillis()
    var totalFocusMillis = 0L
    readableDatabase.rawQuery(
      "SELECT status, start_timestamp, end_timestamp, ended_at FROM sessions",
      null,
    ).use { cursor ->
      while (cursor.moveToNext()) {
        val span = FocusTrendMath.spanOf(
          status = cursor.getString(0),
          startTimestamp = cursor.getLong(1),
          endTimestamp = cursor.getLong(2),
          endedAt = if (cursor.isNull(3)) null else cursor.getLong(3),
          nowMillis = now,
        )
        if (span != null) {
          totalFocusMillis += span.endTimestamp - span.startTimestamp
        }
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

  /** Icons are never persisted: they are large, they change with themes, and the launcher owns them. */
  @Synchronized
  fun getTrends(rawRange: String?): FocusTrends {
    normalizeSessions()
    val range = FocusTrendMath.normalizeRange(rawRange)
    val now = System.currentTimeMillis()
    val edges = FocusTrendMath.edges(now, range)
    val windowStart = edges.first()
    val windowEnd = edges.last()

    val spans = mutableListOf<FocusSpan>()
    readableDatabase.rawQuery(
      """SELECT status, start_timestamp, end_timestamp, ended_at FROM sessions
         WHERE end_timestamp >= ? AND start_timestamp <= ?""",
      arrayOf(windowStart.toString(), windowEnd.toString()),
    ).use { cursor ->
      while (cursor.moveToNext()) {
        val endedAt = if (cursor.isNull(3)) null else cursor.getLong(3)
        FocusTrendMath.spanOf(
          status = cursor.getString(0),
          startTimestamp = cursor.getLong(1),
          endTimestamp = cursor.getLong(2),
          endedAt = endedAt,
          nowMillis = now,
        )?.let(spans::add)
      }
    }

    val totals = FocusTrendMath.distribute(spans, edges)
    val buckets = totals.mapIndexed { index, focusMillis ->
      FocusBucket(
        label = FocusTrendMath.label(edges[index], range),
        startTimestamp = edges[index],
        focusMillis = focusMillis,
      )
    }

    var completedSessions = 0
    readableDatabase.rawQuery(
      "SELECT COUNT(*) FROM sessions WHERE status = 'COMPLETED' AND end_timestamp >= ?",
      arrayOf(windowStart.toString()),
    ).use { cursor -> if (cursor.moveToFirst()) completedSessions = cursor.getInt(0) }

    var blockedAttempts = 0
    readableDatabase.rawQuery(
      "SELECT COUNT(*) FROM block_attempts WHERE attempted_at >= ?",
      arrayOf(windowStart.toString()),
    ).use { cursor -> if (cursor.moveToFirst()) blockedAttempts = cursor.getInt(0) }

    val topApps = mutableListOf<AppAttempt>()
    readableDatabase.rawQuery(
      """SELECT package_name, MAX(app_name), COUNT(*) AS attempts FROM block_attempts
         WHERE attempted_at >= ? GROUP BY package_name ORDER BY attempts DESC, package_name ASC
         LIMIT 5""",
      arrayOf(windowStart.toString()),
    ).use { cursor ->
      while (cursor.moveToNext()) {
        topApps += AppAttempt(cursor.getString(0), cursor.getString(1), cursor.getInt(2))
      }
    }

    return FocusTrends(
      range = range,
      buckets = buckets,
      windowStart = windowStart,
      totalFocusMillis = totals.sum(),
      completedSessions = completedSessions,
      blockedAttempts = blockedAttempts,
      topApps = topApps,
    )
  }

  @Synchronized
  fun getSchedules(): List<StoredSchedule> = readableDatabase.rawQuery(
    "SELECT id, label, days, start_minute, duration_minutes, strict, enabled FROM schedules ORDER BY start_minute ASC, created_at ASC",
    null,
  ).use { cursor ->
    buildList {
      while (cursor.moveToNext()) {
        add(
          StoredSchedule(
            id = cursor.getString(0),
            label = cursor.getString(1),
            days = cursor.getInt(2),
            startMinute = cursor.getInt(3),
            durationMinutes = cursor.getInt(4),
            strict = cursor.getInt(5) == 1,
            enabled = cursor.getInt(6) == 1,
          ),
        )
      }
    }
  }

  @Synchronized
  fun saveSchedule(schedule: StoredSchedule) {
    require(schedule.id.isNotBlank()) { "Schedule id is required." }
    require(schedule.days and ScheduleMath.ALL_DAYS != 0) { "Choose at least one day." }
    require(schedule.startMinute in 0..1439) { "Invalid start time." }
    require(schedule.durationMinutes in 1..1440) { "Duration must be 1 minute to 24 hours." }
    val values = ContentValues().apply {
      put("id", schedule.id)
      put("label", schedule.label)
      put("days", schedule.days and ScheduleMath.ALL_DAYS)
      put("start_minute", schedule.startMinute)
      put("duration_minutes", schedule.durationMinutes)
      put("strict", if (schedule.strict) 1 else 0)
      put("enabled", if (schedule.enabled) 1 else 0)
      put("created_at", System.currentTimeMillis())
    }
    writableDatabase.insertWithOnConflict("schedules", null, values, SQLiteDatabase.CONFLICT_REPLACE)
  }

  @Synchronized
  fun deleteSchedule(id: String) {
    writableDatabase.delete("schedules", "id = ?", arrayOf(id))
  }

  /**
   * What the block screen shows: "book", "words" or "timer". Installs from before the
   * word deck have no such setting, so it is derived from whether a book was chosen.
   */
  @Synchronized
  fun getBlockMaterial(): String = getSetting(BLOCK_MATERIAL)?.takeIf { it in MATERIALS }
    ?: if (getSelectedBook() != null) "book" else "timer"

  @Synchronized
  fun setBlockMaterial(material: String) {
    require(material in MATERIALS) { "Unknown block screen material." }
    setSetting(BLOCK_MATERIAL, material)
  }

  @Synchronized
  fun getWordStates(): Map<String, WordState> = readableDatabase.rawQuery(
    "SELECT word, box, due_at FROM word_progress",
    null,
  ).use { cursor ->
    buildMap { while (cursor.moveToNext()) put(cursor.getString(0), WordState(cursor.getInt(1), cursor.getLong(2))) }
  }

  @Synchronized
  fun saveWordReview(word: String, state: WordState, nowMillis: Long = System.currentTimeMillis()) {
    // No UPSERT: it needs SQLite 3.24, and Android 7 ships 3.9.
    val db = writableDatabase
    db.execSQL("INSERT OR IGNORE INTO word_progress(word, box, due_at, reviews) VALUES (?, 0, 0, 0)", arrayOf(word))
    db.execSQL(
      "UPDATE word_progress SET box = ?, due_at = ?, reviews = reviews + 1 WHERE word = ?",
      arrayOf(state.box, state.dueAt, word),
    )
    bumpDaily("words", nowMillis)
  }

  /** Words seen at least once, and words that have come back known several times. */
  @Synchronized
  fun getWordStats(): Pair<Int, Int> = readableDatabase.rawQuery(
    "SELECT COUNT(*), COALESCE(SUM(CASE WHEN box >= ? THEN 1 ELSE 0 END), 0) FROM word_progress",
    arrayOf(WordScheduler.LEARNED_BOX.toString()),
  ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) to cursor.getInt(1) else 0 to 0 }

  /** The book the block screen opens, or null for the timer and quote instead. */
  @Synchronized
  fun getSelectedBook(): String? = getSetting(SELECTED_BOOK)?.takeIf { it.isNotBlank() }

  @Synchronized
  fun setSelectedBook(id: String?) = setSetting(SELECTED_BOOK, id.orEmpty())

  /** Where the reader left off, so each block screen continues the same book. */
  @Synchronized
  fun getBookPage(id: String): Int = getSetting(BOOK_PAGE_PREFIX + id)?.toIntOrNull() ?: 0

  @Synchronized
  fun setBookPage(id: String, page: Int) = setSetting(BOOK_PAGE_PREFIX + id, page.coerceAtLeast(0).toString())

  @Synchronized
  fun getBookFurthest(id: String): Int = getSetting(BOOK_FURTHEST_PREFIX + id)?.toIntOrNull() ?: 0

  @Synchronized
  fun setBookFurthest(id: String, page: Int) = setSetting(BOOK_FURTHEST_PREFIX + id, page.toString())

  @Synchronized
  fun getPagesRead(): Int = getSetting(PAGES_READ)?.toIntOrNull() ?: 0

  /** Counts a page turned forward for the first time, not one paged back over. */
  @Synchronized
  fun recordPageRead() {
    setSetting(PAGES_READ, (getPagesRead() + 1).toString())
    bumpDaily("pages")
  }

  /** Adds one to today's count in [column], creating today's row if needed. */
  @Synchronized
  fun bumpDaily(column: String, nowMillis: Long = System.currentTimeMillis()) {
    require(column == "pages" || column == "words") { "Unknown progress column." }
    val day = StreakMath.keyOf(StreakMath.dayOf(nowMillis))
    writableDatabase.execSQL("INSERT OR IGNORE INTO daily_progress(day) VALUES (?)", arrayOf(day))
    writableDatabase.execSQL("UPDATE daily_progress SET $column = $column + 1 WHERE day = ?", arrayOf(day))
  }

  /** Pages and words over the last [days] days including today. */
  @Synchronized
  fun getRecentProgress(days: Int, nowMillis: Long = System.currentTimeMillis()): Pair<Int, Int> {
    val today = StreakMath.dayOf(nowMillis)
    val first = StreakMath.keyOf(today - (days - 1))
    return readableDatabase.rawQuery(
      "SELECT COALESCE(SUM(pages), 0), COALESCE(SUM(words), 0) FROM daily_progress WHERE day >= ?",
      arrayOf(first),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) to cursor.getInt(1) else 0 to 0 }
  }

  @Synchronized
  fun setSelectedApps(apps: List<StoredApp>) =
    setSetting(SELECTED_APPS, appsToJson(apps.map { it.copy(iconBase64 = null) }))

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
      db.delete("schedules", null, null)
      db.delete("settings", null, null)
      db.delete("daily_progress", null, null)
      db.delete("word_progress", null, null)
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
    strict = cursor.getInt(cursor.getColumnIndexOrThrow("strict")) == 1,
    brokenAt = cursor.getColumnIndexOrThrow("broken_at").let { if (cursor.isNull(it)) null else cursor.getLong(it) },
  )

  private fun currentBootCount(): Int = try {
    Settings.Global.getInt(appContext.contentResolver, Settings.Global.BOOT_COUNT)
  } catch (_: Exception) {
    -1
  }

  companion object {
    private const val DATABASE_NAME = "focus_guard.db"
    private const val DATABASE_VERSION = 5
    const val SELECTED_APPS = "selected_apps"
    const val ONBOARDING_COMPLETED = "onboarding_completed"
    const val THEME_PREFERENCE = "theme_preference"
    const val LANGUAGE_PREFERENCE = "language_preference"
    const val TILE_DURATION_MINUTES = "tile_duration_minutes"
    const val SELECTED_BOOK = "selected_book"
    const val PAGES_READ = "pages_read_total"
    const val BLOCK_MATERIAL = "block_material"
    private val MATERIALS = setOf("book", "words", "timer")
    private const val BOOK_PAGE_PREFIX = "book_page_"
    private const val BOOK_FURTHEST_PREFIX = "book_far_"

    @Volatile private var instance: FocusDatabase? = null

    fun get(context: Context): FocusDatabase = instance ?: synchronized(this) {
      instance ?: FocusDatabase(context).also { instance = it }
    }

    /** The database file a migration test has to lay down by hand before opening it. */
    @JvmStatic
    val fileName: String get() = DATABASE_NAME

    /**
     * Drops the cached instance so a test can open the same file again from scratch.
     * Nothing in the app calls this: one process keeps one connection for its life.
     */
    @JvmStatic
    fun resetForTests() {
      synchronized(this) {
        instance?.close()
        instance = null
      }
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

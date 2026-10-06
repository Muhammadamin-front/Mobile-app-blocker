package uz.qoriqchi.app

import android.app.Application
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Migrations are the one kind of bug that cannot be fixed in the next release: by the
 * time it is noticed, the history it was supposed to carry forward is already gone.
 * These tests lay down each old schema by hand, seed it, and open the real helper.
 */
// A plain Application: the real one boots React Native, whose native libraries do
// not exist in a JVM test and are irrelevant to a schema upgrade.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class FocusDatabaseMigrationTest {

  private val context: Context get() = ApplicationProvider.getApplicationContext()

  @Before
  fun clean() {
    FocusDatabase.resetForTests()
    context.deleteDatabase(FocusDatabase.fileName)
  }

  @After
  fun tearDown() {
    FocusDatabase.resetForTests()
    context.deleteDatabase(FocusDatabase.fileName)
  }

  @Test
  fun upgradingFromTheFirstVersionKeepsFinishedSessions() {
    createLegacy(1) { db ->
      insertSession(db, id = "old-1", status = "COMPLETED", version = 1)
      insertAttempt(db, "old-1", "com.example.social")
      insertAttempt(db, "old-1", "com.example.social")
    }

    val database = FocusDatabase.get(context)
    val history = database.getHistory()

    assertEquals(1, history.size)
    assertEquals("old-1", history[0].id)
    assertEquals("COMPLETED", history[0].status)
    assertEquals(2, history[0].blockedAttempts)
  }

  @Test
  fun aCompletedSessionGetsItsEndBackfilledSoItStillCountsAsFocusTime() {
    createLegacy(1) { db ->
      insertSession(db, id = "old-2", status = "COMPLETED", version = 1)
    }

    val database = FocusDatabase.get(context)
    val stats = database.getStatistics()

    // The row had no ended_at at all; version 2 backfills it from the planned end.
    assertEquals(HOUR, stats["totalFocusMillis"] as Long)
    assertEquals(1, stats["completedSessions"] as Int)
  }

  @Test
  fun aSessionStoppedBeforeEndTrackingIsNotGuessedAt() {
    createLegacy(1) { db ->
      insertSession(db, id = "old-3", status = "STOPPED", version = 1)
    }

    val database = FocusDatabase.get(context)

    // It is still in the history, but it contributes no measured time, because
    // nothing recorded when it actually stopped.
    assertEquals(1, database.getHistory().size)
    assertEquals(0L, database.getStatistics()["totalFocusMillis"] as Long)
  }

  @Test
  fun oldSessionsBecomeOrdinaryRatherThanStrict() {
    createLegacy(2) { db ->
      insertSession(db, id = "old-4", status = "COMPLETED", version = 2)
    }

    val database = FocusDatabase.get(context)

    assertFalse(database.getHistory().single().strict)
  }

  @Test
  fun upgradingCreatesTheSchedulesTableAndItIsWritable() {
    createLegacy(3) { db ->
      insertSession(db, id = "old-5", status = "COMPLETED", version = 3)
    }

    val database = FocusDatabase.get(context)
    assertTrue(database.getSchedules().isEmpty())

    database.saveSchedule(
      StoredSchedule(
        id = "s1",
        label = "Mornings",
        days = ScheduleMath.WEEKDAYS,
        startMinute = 9 * 60,
        durationMinutes = 60,
        strict = false,
        enabled = true,
      ),
    )

    val saved = database.getSchedules().single()
    assertEquals("s1", saved.id)
    assertEquals(ScheduleMath.WEEKDAYS, saved.days)
    assertEquals(540, saved.startMinute)
  }

  @Test
  fun settingsSurviveEveryUpgrade() {
    createLegacy(1) { db ->
      db.execSQL(
        "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)",
        arrayOf(FocusDatabase.ONBOARDING_COMPLETED, "true"),
      )
      db.execSQL(
        "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)",
        arrayOf(FocusDatabase.SELECTED_APPS, """[{"packageName":"com.example.a","appName":"A"}]"""),
      )
    }

    val database = FocusDatabase.get(context)

    assertEquals("true", database.getSetting(FocusDatabase.ONBOARDING_COMPLETED))
    assertEquals("com.example.a", database.getSelectedApps().single().packageName)
  }

  @Test
  fun anEndedAtAlreadyRecordedIsNotOverwritten() {
    val realEnd = NOW - 30 * 60_000L
    createLegacy(2) { db ->
      insertSession(db, id = "old-6", status = "STOPPED", version = 2, endedAt = realEnd)
    }

    val database = FocusDatabase.get(context)
    val stats = database.getStatistics()

    // Started an hour ago, stopped half an hour ago: half an hour of measured focus.
    assertEquals(30 * 60_000L, stats["totalFocusMillis"] as Long)
  }

  @Test
  fun openingAnAlreadyCurrentDatabaseChangesNothing() {
    val first = FocusDatabase.get(context)
    first.setSetting("probe", "kept")
    FocusDatabase.resetForTests()

    val second = FocusDatabase.get(context)

    assertEquals("kept", second.getSetting("probe"))
    assertNotNull(second.getSchedules())
  }

  // --- helpers -------------------------------------------------------------

  private fun createLegacy(version: Int, seed: (SQLiteDatabase) -> Unit) {
    val db = context.openOrCreateDatabase(FocusDatabase.fileName, Context.MODE_PRIVATE, null)
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
    if (version >= 2) {
      db.execSQL("ALTER TABLE sessions ADD COLUMN ended_at INTEGER")
    }
    if (version >= 3) {
      db.execSQL("ALTER TABLE sessions ADD COLUMN strict INTEGER NOT NULL DEFAULT 0")
    }
    seed(db)
    db.version = version
    db.close()
  }

  private fun insertSession(
    db: SQLiteDatabase,
    id: String,
    status: String,
    version: Int,
    endedAt: Long? = null,
  ) {
    val start = NOW - HOUR
    val end = NOW
    val columns = StringBuilder(
      "id, start_timestamp, end_timestamp, start_elapsed, duration_millis, boot_count, " +
        "blocked_apps, status, completed_reason, created_at",
    )
    val values = StringBuilder("?, ?, ?, ?, ?, ?, ?, ?, ?, ?")
    val args = mutableListOf<Any?>(
      id, start, end, 0L, HOUR, 1,
      """[{"packageName":"com.example.social","appName":"Social"}]""",
      status, if (status == "STOPPED") "user" else "expired", start,
    )
    if (version >= 2) {
      columns.append(", ended_at")
      values.append(", ?")
      args.add(endedAt)
    }
    db.execSQL("INSERT INTO sessions ($columns) VALUES ($values)", args.toTypedArray())
  }

  private fun insertAttempt(db: SQLiteDatabase, sessionId: String, packageName: String) {
    db.execSQL(
      "INSERT INTO block_attempts (session_id, package_name, app_name, attempted_at) VALUES (?, ?, ?, ?)",
      arrayOf(sessionId, packageName, "Social", NOW - 10_000L),
    )
  }

  private companion object {
    const val HOUR = 60 * 60_000L
    val NOW = System.currentTimeMillis()
  }
}

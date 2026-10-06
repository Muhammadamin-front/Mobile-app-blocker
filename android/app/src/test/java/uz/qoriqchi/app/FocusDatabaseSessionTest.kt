package uz.qoriqchi.app

import android.app.Application
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The rules a session lives by, exercised against real SQLite rather than against a
 * model of it: only one at a time, a strict one cannot be talked out of running, and
 * an expired one retires itself without anyone asking.
 */
// The real Application boots React Native, which has no native libraries in a JVM
// test and no business here: these tests are about SQLite.
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class FocusDatabaseSessionTest {

  private val context: Context get() = ApplicationProvider.getApplicationContext()
  private lateinit var database: FocusDatabase

  private val apps = listOf(StoredApp("com.example.social", "Social"))

  @Before
  fun setUp() {
    FocusDatabase.resetForTests()
    context.deleteDatabase(FocusDatabase.fileName)
    database = FocusDatabase.get(context)
  }

  @After
  fun tearDown() {
    FocusDatabase.resetForTests()
    context.deleteDatabase(FocusDatabase.fileName)
  }

  private fun start(
    id: String = "s1",
    minutes: Long = 30,
    strict: Boolean = false,
  ): StoredSession {
    val now = System.currentTimeMillis()
    return database.startSession(id, now, now + minutes * 60_000L, apps, strict)
  }

  @Test
  fun aSecondSessionIsRefusedWhileOneIsRunning() {
    start()

    val error = runCatching { start(id = "s2") }.exceptionOrNull()

    assertTrue("expected a refusal, got $error", error is IllegalStateException)
    assertEquals("s1", database.getCurrentSession()?.id)
  }

  @Test
  fun aStrictSessionRefusesToStop() {
    start(strict = true)

    val error = runCatching { database.stopSession() }.exceptionOrNull()

    assertTrue("expected a refusal, got $error", error is IllegalStateException)
    assertNotNull("the session must still be running", database.getCurrentSession())
  }

  @Test
  fun anOrdinarySessionStopsAndRecordsWhenItEnded() {
    start()

    val stopped = database.stopSession()

    assertEquals("STOPPED", stopped?.status)
    assertNull(database.getCurrentSession())
    // Stopped immediately, so it protected almost nothing — and certainly not the
    // half hour it was planned for.
    assertTrue((database.getStatistics()["totalFocusMillis"] as Long) < 60_000L)
  }

  @Test
  fun aSessionThatRanOutRetiresItself() {
    val now = System.currentTimeMillis()
    database.startSession("short", now, now + 600L, apps, false)

    Thread.sleep(900L)
    database.normalizeSessions()

    assertNull(database.getCurrentSession())
    assertEquals("COMPLETED", database.getHistory().single().status)
  }

  @Test
  fun aSessionRefusesToStartWithNothingToBlock() {
    val now = System.currentTimeMillis()

    val error = runCatching {
      database.startSession("empty", now, now + 60_000L, emptyList(), false)
    }.exceptionOrNull()

    assertTrue("expected a refusal, got $error", error is IllegalArgumentException)
  }

  @Test
  fun aSessionRefusesToStartInThePast() {
    val now = System.currentTimeMillis()

    val error = runCatching {
      database.startSession("past", now - 120_000L, now - 60_000L, apps, false)
    }.exceptionOrNull()

    assertTrue("expected a refusal, got $error", error is IllegalArgumentException)
  }

  @Test
  fun aScheduledSessionIsNotEnforcedUntilItStarts() {
    val now = System.currentTimeMillis()
    database.startSession("later", now + 60_000L, now + 120_000L, apps, false)

    assertEquals("SCHEDULED", database.getCurrentSession()?.status)
    assertNull("nothing should be enforced yet", database.getEnforceableSession())
  }

  @Test
  fun iconsNeverReachTheDatabase() {
    database.setSelectedApps(listOf(StoredApp("com.example.a", "A", "a-very-long-base64")))

    assertNull(database.getSelectedApps().single().iconBase64)
  }

  @Test
  fun resetClearsSessionsSchedulesAndSettings() {
    start()
    database.setSetting("probe", "value")
    database.saveSchedule(
      StoredSchedule("s", "", ScheduleMath.ALL_DAYS, 8 * 60, 30, false, true),
    )

    database.resetAllData()

    assertNull(database.getCurrentSession())
    assertTrue(database.getHistory().isEmpty())
    assertTrue(database.getSchedules().isEmpty())
    assertNull(database.getSetting("probe"))
  }

  @Test
  fun aScheduleWithNoDaysIsRefused() {
    val error = runCatching {
      database.saveSchedule(StoredSchedule("bad", "", 0, 8 * 60, 30, false, true))
    }.exceptionOrNull()

    assertTrue("expected a refusal, got $error", error is IllegalArgumentException)
  }

  @Test
  fun savingTheSameScheduleTwiceUpdatesItInsteadOfDuplicating() {
    val schedule = StoredSchedule("s", "", ScheduleMath.WEEKDAYS, 9 * 60, 60, false, true)
    database.saveSchedule(schedule)
    database.saveSchedule(schedule.copy(startMinute = 10 * 60, enabled = false))

    val saved = database.getSchedules().single()
    assertEquals(10 * 60, saved.startMinute)
    assertEquals(false, saved.enabled)
  }
}

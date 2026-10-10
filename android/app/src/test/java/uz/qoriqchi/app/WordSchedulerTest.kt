package uz.qoriqchi.app

import org.junit.Assert.assertEquals
import org.junit.Test

class WordSchedulerTest {
  private val day = 86_400_000L
  private val now = 1_800_000_000_000L
  private val deck = listOf("achieve", "budget", "climate", "debt", "effort").map { DeckWord(it, "", "") }

  @Test
  fun aKnownWordComesBackLaterEachTime() {
    val first = WordScheduler.known(null, now)
    val second = WordScheduler.known(first, now)
    val third = WordScheduler.known(second, now)
    assertEquals(now + day, first.dueAt)
    assertEquals(now + 3 * day, second.dueAt)
    assertEquals(now + 7 * day, third.dueAt)
  }

  @Test
  fun aMissedWordDropsToTheBottomAndReturnsSoon() {
    val missed = WordScheduler.again(now)
    assertEquals(0, missed.box)
    assertEquals(now + 10 * 60_000L, missed.dueAt)
  }

  @Test
  fun theTopBoxIsACeiling() {
    var state: WordState? = null
    repeat(20) { state = WordScheduler.known(state, now) }
    assertEquals(6, state!!.box)
  }

  @Test
  fun dueWordsComeBeforeNewOnesOldestFirst() {
    val states = mapOf(
      "climate" to WordState(1, now - 1_000),
      "debt" to WordState(2, now - 5_000),
      "budget" to WordState(3, now + day),
    )
    val next = WordScheduler.next(deck, states, now, 3).map { it.word }
    assertEquals(listOf("debt", "climate", "achieve"), next)
  }

  @Test
  fun notYetDueWordsWaitTheirTurn() {
    val states = deck.associate { it.word to WordState(2, now + day) }
    assertEquals(emptyList<DeckWord>(), WordScheduler.next(deck, states, now, 5))
  }
}

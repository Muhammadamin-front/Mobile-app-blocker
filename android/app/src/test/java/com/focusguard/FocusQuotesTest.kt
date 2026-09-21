package com.focusguard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusQuotesTest {
  @Test
  fun theSameSessionKeepsTheSameQuote() {
    assertEquals(FocusQuotes.indexFor(4321, 8), FocusQuotes.indexFor(4321, 8))
  }

  @Test
  fun aNegativeSeedStillLandsInsideTheList() {
    // Session ids are hashed, and a hash is signed.
    listOf(-1, -7, -12345, Int.MIN_VALUE + 1).forEach { seed ->
      val index = FocusQuotes.indexFor(seed, 8)
      assertTrue("index $index out of range for seed $seed", index in 0..7)
    }
  }

  @Test
  fun everyQuoteIsReachable() {
    val seen = (0 until 8).map { FocusQuotes.indexFor(it, 8) }.toSet()
    assertEquals(8, seen.size)
  }

  @Test
  fun anEmptyListAsksForNothingRatherThanCrashing() {
    assertEquals(-1, FocusQuotes.indexFor(3, 0))
    assertEquals(-1, FocusQuotes.indexFor(3, -2))
  }
}

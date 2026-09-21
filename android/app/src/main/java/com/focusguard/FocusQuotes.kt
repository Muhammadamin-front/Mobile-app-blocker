package com.focusguard

import android.content.Context

data class FocusQuote(val text: String, val author: String)

/**
 * The line shown under the block screen's timer. The choice is seeded by the session
 * so it holds still while one session keeps turning the same app away, rather than
 * shuffling every time the screen reappears.
 */
object FocusQuotes {
  fun indexFor(seed: Int, count: Int): Int {
    if (count <= 0) {
      return -1
    }
    val remainder = seed % count
    return if (remainder < 0) remainder + count else remainder
  }

  fun quoteFor(context: Context, seed: Int): FocusQuote? = try {
    val texts = context.resources.getStringArray(R.array.focus_quotes)
    val authors = context.resources.getStringArray(R.array.focus_quote_authors)
    val index = indexFor(seed, minOf(texts.size, authors.size))
    if (index < 0) null else FocusQuote(texts[index], authors[index])
  } catch (_: Exception) {
    null
  }
}

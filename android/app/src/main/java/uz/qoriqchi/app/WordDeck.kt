package uz.qoriqchi.app

import android.content.Context
import android.util.Log
import org.json.JSONObject

data class DeckWord(
  val word: String,
  /** A short English definition, from the NGSL's easy-English list. */
  val definition: String,
  val uzbek: String,
)

data class WordState(val box: Int, val dueAt: Long)

/**
 * Spaced review in its simplest honest form, a Leitner box: a word you know moves up a
 * box and comes back later each time; a word you miss drops to the bottom and comes
 * back within minutes. Kept free of Android so the rule is tested directly.
 */
object WordScheduler {
  /** Minutes before a missed word may come back. */
  const val AGAIN_MINUTES = 10L
  /** A word in this box or higher has come back and been known several times over. */
  const val LEARNED_BOX = 3
  private val INTERVAL_DAYS = longArrayOf(0, 1, 3, 7, 16, 35, 90)

  fun known(previous: WordState?, now: Long): WordState {
    val box = ((previous?.box ?: 0) + 1).coerceAtMost(INTERVAL_DAYS.lastIndex)
    return WordState(box, now + INTERVAL_DAYS[box] * DAY_MILLIS)
  }

  fun again(now: Long): WordState = WordState(0, now + AGAIN_MINUTES * 60_000L)

  /**
   * The next [count] words: anything due for review first, oldest due first, then
   * words never seen, in the deck's own order (most frequent first).
   */
  fun next(deck: List<DeckWord>, states: Map<String, WordState>, now: Long, count: Int): List<DeckWord> {
    val due = deck
      .filter { word -> states[word.word]?.let { it.dueAt <= now } == true }
      .sortedBy { states.getValue(it.word).dueAt }
    val fresh = deck.filter { it.word !in states }
    return (due + fresh).take(count)
  }

  private const val DAY_MILLIS = 86_400_000L
}

/** The bundled deck, parsed once per process. */
object WordDeck {
  private const val TAG = "FocusGuard"
  const val ID = "ngsl-b1b2"
  @Volatile private var words: List<DeckWord>? = null

  fun words(context: Context): List<DeckWord> = words ?: synchronized(this) {
    words ?: load(context).also { words = it }
  }

  private fun load(context: Context): List<DeckWord> = try {
    val json = context.assets.open("words/$ID.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
    val array = JSONObject(json).getJSONArray("words")
    (0 until array.length()).map { index ->
      val item = array.getJSONObject(index)
      DeckWord(item.getString("w"), item.optString("d"), item.getString("uz"))
    }
  } catch (error: Exception) {
    Log.w(TAG, "The word deck could not be read.", error)
    emptyList()
  }
}

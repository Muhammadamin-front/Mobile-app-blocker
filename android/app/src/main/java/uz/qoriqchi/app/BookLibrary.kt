package uz.qoriqchi.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

data class BookInfo(
  val id: String,
  val title: String,
  val author: String,
  val year: Int,
  val license: String,
  val source: String,
)

data class BookPage(
  /** Chapter heading, carried on the first page of each chapter only. */
  val chapterTitle: String?,
  val text: String,
)

/**
 * Splits text into pages that fit a phone screen. Kept free of Android so the rule
 * that decides where a page ends — a paragraph if possible, a sentence or a word if
 * not, never mid-word — is unit tested directly.
 */
object BookPager {
  const val DEFAULT_PAGE_CHARS = 650

  fun paginate(text: String, maxChars: Int = DEFAULT_PAGE_CHARS): List<String> {
    require(maxChars >= 100) { "A page needs room for at least a sentence." }
    val pages = mutableListOf<String>()
    val current = StringBuilder()

    fun flush() {
      if (current.isNotBlank()) {
        pages += current.toString().trim()
      }
      current.setLength(0)
    }

    for (paragraph in text.split(Regex("\n\\s*\n")).map { it.trim() }.filter { it.isNotEmpty() }) {
      var rest = paragraph
      while (rest.isNotEmpty()) {
        val room = maxChars - current.length - (if (current.isEmpty()) 0 else 2)
        if (rest.length <= room) {
          if (current.isNotEmpty()) current.append("\n\n")
          current.append(rest)
          rest = ""
        } else if (current.isNotEmpty() && room < maxChars / 3) {
          // Not worth squeezing a fragment onto a nearly full page.
          flush()
        } else {
          val cut = breakPoint(rest, room.coerceAtLeast(1))
          if (current.isNotEmpty()) current.append("\n\n")
          current.append(rest.substring(0, cut).trim())
          rest = rest.substring(cut).trim()
          flush()
        }
      }
    }
    flush()
    return pages
  }

  /** The last sentence end within [limit], else the last space, else a hard cut. */
  internal fun breakPoint(text: String, limit: Int): Int {
    if (text.length <= limit) return text.length
    val window = text.substring(0, limit)
    val sentence = Regex("[.!?…»\"]\\s").findAll(window).lastOrNull()
    if (sentence != null && sentence.range.last > limit / 2) {
      return sentence.range.last
    }
    val space = window.lastIndexOf(' ')
    return if (space > limit / 3) space else limit
  }
}

/**
 * The public-domain books bundled in assets/books. Parsed and paginated once per
 * process — a novel is about a megabyte of JSON, too much to re-read on every
 * block screen.
 */
object BookLibrary {
  private const val TAG = "FocusGuard"
  private const val CATALOG = "books/catalog.json"

  @Volatile private var catalog: List<BookInfo>? = null
  private val pages = mutableMapOf<String, List<BookPage>>()

  fun catalog(context: Context): List<BookInfo> = catalog ?: synchronized(this) {
    catalog ?: load(context).also { catalog = it }
  }

  private fun load(context: Context): List<BookInfo> = try {
    val json = context.assets.open(CATALOG).bufferedReader(Charsets.UTF_8).use { it.readText() }
    val array = JSONArray(json)
    (0 until array.length()).map { index ->
      val item = array.getJSONObject(index)
      BookInfo(
        id = item.getString("id"),
        title = item.getString("title"),
        author = item.getString("author"),
        year = item.optInt("year"),
        license = item.optString("license"),
        source = item.optString("source"),
      )
    }
  } catch (error: Exception) {
    Log.w(TAG, "No bundled books could be read.", error)
    emptyList()
  }

  fun book(context: Context, id: String): BookInfo? = catalog(context).firstOrNull { it.id == id }

  fun pages(context: Context, id: String): List<BookPage> = synchronized(this) {
    pages.getOrPut(id) {
      try {
        val json = context.assets.open("books/$id.json")
          .bufferedReader(Charsets.UTF_8).use { it.readText() }
        val chapters = JSONObject(json).getJSONArray("chapters")
        buildList {
          for (index in 0 until chapters.length()) {
            val chapter = chapters.getJSONObject(index)
            BookPager.paginate(chapter.getString("text")).forEachIndexed { pageIndex, text ->
              add(BookPage(if (pageIndex == 0) chapter.optString("title") else null, text))
            }
          }
        }
      } catch (error: Exception) {
        Log.w(TAG, "Could not read book $id.", error)
        emptyList()
      }
    }
  }
}

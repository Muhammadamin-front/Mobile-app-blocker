package uz.qoriqchi.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BookPagerTest {
  private val sentence = "Bu sinov uchun yozilgan oddiy jumla. "

  @Test
  fun aShortTextIsOnePage() {
    assertEquals(listOf("Qisqa matn."), BookPager.paginate("Qisqa matn.", 200))
  }

  @Test
  fun noPageIsLongerThanTheLimit() {
    val text = sentence.repeat(200)
    BookPager.paginate(text, 300).forEach { page ->
      assertTrue("page of ${page.length} chars", page.length <= 300)
    }
  }

  @Test
  fun nothingIsLostOrDuplicated() {
    val words = (1..800).joinToString(" ") { "so'z$it" }
    val rejoined = BookPager.paginate(words, 250).joinToString(" ")
    assertEquals(words.split(" "), rejoined.split(Regex("\\s+")))
  }

  @Test
  fun aWordIsNeverCutInHalf() {
    val words = (1..400).joinToString(" ") { "uzunso'z$it" }
    BookPager.paginate(words, 180).forEach { page ->
      page.split(" ").forEach { word -> assertTrue("broken word '$word'", word.startsWith("uzunso'z")) }
    }
  }

  @Test
  fun aPagePrefersToEndOnASentence() {
    val text = sentence.repeat(30)
    val pages = BookPager.paginate(text, 200)
    assertTrue(pages.size > 1)
    pages.dropLast(1).forEach { page -> assertTrue("'${page.takeLast(20)}'", page.endsWith(".")) }
  }

  @Test
  fun paragraphsStayParagraphs() {
    val pages = BookPager.paginate("Birinchi xatboshi.\n\nIkkinchi xatboshi.", 500)
    assertEquals(1, pages.size)
    assertEquals("Birinchi xatboshi.\n\nIkkinchi xatboshi.", pages.single())
  }

  @Test
  fun anEmptyTextHasNoPages() {
    assertTrue(BookPager.paginate("   \n\n  ", 200).isEmpty())
    assertFalse(BookPager.paginate("a", 200).isEmpty())
  }
}

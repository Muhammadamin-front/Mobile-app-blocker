package uz.qoriqchi.app

import android.content.Context
import java.util.Calendar
import java.util.TimeZone

data class StoredExam(
  /** dtm, attestation, ielts, cefr or custom. */
  val kind: String,
  /** The student's own name for it; used when [kind] is custom. */
  val label: String,
  /** A local calendar date, yyyy-MM-dd. */
  val date: String,
)

/**
 * The exam a student is counting down to. The block screen is where the number earns
 * its keep: reaching for Instagram and reading "DTM in 87 days" is the argument.
 */
object ExamCountdown {
  const val KINDS = "dtm,attestation,ielts,cefr,custom"
  private const val KIND = "exam_kind"
  private const val LABEL = "exam_label"
  private const val DATE = "exam_date"
  private val DATE_PATTERN = Regex("""^(\d{4})-(\d{2})-(\d{2})$""")

  fun read(database: FocusDatabase): StoredExam? {
    val date = database.getSetting(DATE)?.takeIf { DATE_PATTERN.matches(it) } ?: return null
    val kind = database.getSetting(KIND)?.takeIf { it in KINDS.split(',') } ?: return null
    return StoredExam(kind, database.getSetting(LABEL).orEmpty(), date)
  }

  fun write(database: FocusDatabase, exam: StoredExam?) {
    if (exam == null) {
      database.setSetting(DATE, "")
      return
    }
    require(exam.kind in KINDS.split(',')) { "Unknown exam." }
    require(dayOfDate(exam.date) != null) { "The exam date must be yyyy-mm-dd." }
    database.setSetting(KIND, exam.kind)
    database.setSetting(LABEL, exam.label.trim().take(40))
    database.setSetting(DATE, exam.date)
  }

  /** Whole calendar days from [today] to [date]; 0 on the day, negative after. */
  fun daysUntil(date: String, today: Long): Long? = dayOfDate(date)?.let { it - today }

  internal fun dayOfDate(date: String): Long? {
    val match = DATE_PATTERN.matchEntire(date) ?: return null
    val (year, month, day) = match.destructured
    val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
      clear()
      isLenient = false
      set(year.toInt(), month.toInt() - 1, day.toInt())
    }
    return runCatching { Math.floorDiv(calendar.timeInMillis, 86_400_000L) }.getOrNull()
  }

  /** The line for the block screen, or null when no exam is set or it has passed. */
  fun blockLine(context: Context, database: FocusDatabase, nowMillis: Long = System.currentTimeMillis()): String? {
    val exam = read(database) ?: return null
    val days = daysUntil(exam.date, StreakMath.dayOf(nowMillis)) ?: return null
    if (days < 0) return null
    val name = when (exam.kind) {
      "dtm" -> context.getString(R.string.exam_dtm)
      "attestation" -> context.getString(R.string.exam_attestation)
      "ielts" -> "IELTS"
      "cefr" -> "CEFR"
      else -> exam.label.ifBlank { context.getString(R.string.exam_generic) }
    }
    return when (days) {
      0L -> context.getString(R.string.block_exam_today, name)
      1L -> context.getString(R.string.block_exam_tomorrow, name)
      else -> context.getString(R.string.block_exam_days, name, days.toInt())
    }
  }
}

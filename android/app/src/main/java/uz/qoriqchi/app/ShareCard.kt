package uz.qoriqchi.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream

/** What the card says. Every number comes from the phone's own records. */
data class WeekSummary(
  val focusMillis: Long,
  val streak: Int,
  val pages: Int,
  val bookTitle: String?,
  val words: Int,
  val examLine: String?,
)

/**
 * Draws the weekly card people post to Telegram. It is a picture rather than a link
 * because the app has no server to link to, and a picture travels on its own: the
 * numbers, the brand, and nothing else about the person.
 */
object ShareCard {
  const val WIDTH = 1080
  const val HEIGHT = 1350
  private const val PLAY_URL = "https://play.google.com/store/apps/details?id=uz.qoriqchi.app"

  fun summarize(context: Context): WeekSummary {
    val database = FocusDatabase.get(context)
    val (pages, words) = database.getRecentProgress(7)
    val book = if (database.getBlockMaterial() == "book") {
      database.getSelectedBook()?.let { BookLibrary.book(context, it)?.title }
    } else {
      null
    }
    return WeekSummary(
      focusMillis = database.getTrends("week").totalFocusMillis,
      streak = database.getStreak().current,
      pages = pages,
      bookTitle = book,
      words = words,
      // In the app's language, not the phone's: the card says what the app says.
      examLine = ExamCountdown.blockLine(AppLocale.wrap(context), database),
    )
  }

  /** The words that go with the picture. The Play link only once the app is from Play. */
  fun caption(context: Context, summary: WeekSummary): String {
    val strings = AppLocale.wrap(context)
    val line = strings.getString(R.string.share_caption, duration(strings, summary.focusMillis))
    return if (installedFromPlay(context)) "$line\n$PLAY_URL" else line
  }

  fun render(context: Context, summary: WeekSummary): File {
    val strings = AppLocale.wrap(context)
    val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    canvas.drawColor(NAVY)
    paint.color = NAVY_LIGHT
    canvas.drawCircle(WIDTH + 60f, -80f, 520f, paint)
    paint.color = Color.argb(60, 255, 196, 0)
    canvas.drawCircle(-140f, HEIGHT + 120f, 420f, paint)

    // The mark and the name.
    ContextCompat.getDrawable(context, R.drawable.ic_launcher_foreground)?.let { mark ->
      mark.setBounds(52, 52, 52 + 200, 52 + 200)
      mark.draw(canvas)
    }
    text(canvas, "QORIQCHI", 252f, 166f, 46f, Color.WHITE, bold = true, tracking = 0.18f)

    val left = 96f
    text(canvas, strings.getString(R.string.share_this_week).uppercase(), left, 420f, 38f, YELLOW, bold = true, tracking = 0.16f)
    text(canvas, duration(strings, summary.focusMillis), left, 560f, 128f, Color.WHITE, bold = true, tracking = -0.02f)
    text(canvas, strings.getString(R.string.share_focus_label), left, 630f, 42f, MUTED)

    val rows = buildList {
      if (summary.streak > 0) add(summary.streak.toString() to strings.getString(R.string.share_streak))
      if (summary.pages > 0) {
        add(summary.pages.toString() to (summary.bookTitle?.let { strings.getString(R.string.share_pages_of, it) }
          ?: strings.getString(R.string.share_pages)))
      }
      if (summary.words > 0) add(summary.words.toString() to strings.getString(R.string.share_words))
    }
    var y = 740f
    rows.forEach { (value, label) ->
      paint.color = SURFACE
      canvas.drawRoundRect(RectF(left, y, WIDTH - left, y + 120f), 36f, 36f, paint)
      text(canvas, value, left + 44f, y + 80f, 56f, YELLOW, bold = true)
      val labelX = left + 44f + measure(value, 56f, bold = true) + 28f
      text(canvas, label, labelX, y + 78f, 38f, Color.WHITE, maxWidth = WIDTH - left - 44f - labelX)
      y += 144f
    }

    summary.examLine?.let { line ->
      paint.color = YELLOW
      val width = measure(line, 40f, bold = true) + 80f
      canvas.drawRoundRect(RectF(left, y + 8f, left + width.coerceAtMost(WIDTH - 2 * left), y + 104f), 48f, 48f, paint)
      text(canvas, line, left + 40f, y + 70f, 40f, NAVY, bold = true, maxWidth = WIDTH - 2 * left - 80f)
    }

    text(canvas, strings.getString(R.string.share_footer), left, HEIGHT - 96f, 34f, MUTED)

    val directory = File(context.cacheDir, "share").apply { mkdirs() }
    val file = File(directory, "qoriqchi-week.png")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    bitmap.recycle()
    return file
  }

  private fun duration(strings: Context, millis: Long): String {
    val minutes = (millis / 60_000L).toInt()
    val hours = minutes / 60
    return if (hours == 0) {
      strings.getString(R.string.share_minutes, minutes)
    } else {
      strings.getString(R.string.share_hours_minutes, hours, minutes % 60)
    }
  }

  private fun installedFromPlay(context: Context): Boolean = runCatching {
    val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getInstallerPackageName(context.packageName)
    }
    installer == "com.android.vending"
  }.getOrDefault(false)

  private fun textPaint(size: Float, color: Int, bold: Boolean, tracking: Float) =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = size
      this.color = color
      typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
      letterSpacing = tracking
    }

  private fun measure(value: String, size: Float, bold: Boolean = false) =
    textPaint(size, Color.WHITE, bold, 0f).measureText(value)

  private fun text(
    canvas: Canvas,
    value: String,
    x: Float,
    y: Float,
    size: Float,
    color: Int,
    bold: Boolean = false,
    tracking: Float = 0f,
    maxWidth: Float = WIDTH - x - 80f,
  ) {
    val paint = textPaint(size, color, bold, tracking)
    // Long book titles and exam names are shortened rather than run off the card.
    var shown = value
    while (shown.length > 1 && paint.measureText(shown) > maxWidth) shown = shown.dropLast(2) + "…"
    canvas.drawText(shown, x, y, paint)
  }

  private val NAVY = Color.rgb(7, 20, 38)
  private val NAVY_LIGHT = Color.rgb(18, 58, 104)
  private val SURFACE = Color.argb(235, 14, 40, 76)
  private val YELLOW = Color.rgb(255, 196, 0)
  private val MUTED = Color.rgb(170, 186, 210)
}

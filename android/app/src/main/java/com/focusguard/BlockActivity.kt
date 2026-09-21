package com.focusguard

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Native by design: this screen remains available when the React Native process is gone.
 * Its timer is monotonic, while periodic database checks notice sessions ended elsewhere.
 */
class BlockActivity : ComponentActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()
  private lateinit var database: FocusDatabase
  private lateinit var timerText: TextView
  private lateinit var appNameText: TextView
  private lateinit var appIconView: ImageView
  private lateinit var appIconFallback: TextView
  private lateinit var shieldView: FocusShieldView
  private lateinit var quoteText: TextView
  private lateinit var quoteAuthorText: TextView
  private var blockedPackage: String = ""
  private var endElapsed = 0L
  private var lastSyncElapsed = 0L
  private var leaving = false

  private val updateTimer = object : Runnable {
    override fun run() {
      val now = SystemClock.elapsedRealtime()
      val remaining = endElapsed - now
      if (remaining <= 0L) {
        syncSession()
        return
      }
      timerText.text = formatRemaining(remaining)
      if (now - lastSyncElapsed >= SYNC_INTERVAL_MILLIS) syncSession()
      handler.postDelayed(this, 500L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    database = FocusDatabase.get(this)
    setContentView(buildContent())
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() = goHome()
    })
    applyIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    isVisible = true
    handler.removeCallbacks(updateTimer)
    handler.post(updateTimer)
  }

  override fun onPause() {
    isVisible = false
    handler.removeCallbacks(updateTimer)
    super.onPause()
  }

  override fun onDestroy() {
    handler.removeCallbacks(updateTimer)
    executor.shutdown()
    super.onDestroy()
  }

  private fun applyIntent(intent: Intent) {
    leaving = false
    blockedPackage = intent.getStringExtra(EXTRA_PACKAGE_NAME).orEmpty()
    val appName = intent.getStringExtra(EXTRA_APP_NAME).orEmpty().ifBlank { "This app" }
    val initial = appName.take(1).uppercase()
    val icon = loadAppIcon()

    appIconFallback.text = initial
    appIconFallback.visibility = if (icon == null) View.VISIBLE else View.GONE
    appIconView.visibility = if (icon == null) View.GONE else View.VISIBLE
    appIconView.setImageDrawable(icon)
    shieldView.setBlockedApp(loadAppIcon(), initial)
    appNameText.text = getString(R.string.block_app_message, appName)

    val quote = FocusQuotes.quoteFor(this, intent.getIntExtra(EXTRA_QUOTE_SEED, 0))
    if (quote == null) {
      quoteText.visibility = View.GONE
      quoteAuthorText.visibility = View.GONE
    } else {
      quoteText.visibility = View.VISIBLE
      quoteAuthorText.visibility = View.VISIBLE
      quoteText.text = getString(R.string.block_quote, quote.text)
      quoteAuthorText.text = getString(R.string.block_quote_author, quote.author)
    }

    val remaining = intent.getLongExtra(EXTRA_REMAINING_MILLIS, 0L)
    endElapsed = SystemClock.elapsedRealtime() + remaining
    lastSyncElapsed = SystemClock.elapsedRealtime()
    timerText.text = formatRemaining(remaining)
    handler.removeCallbacks(updateTimer)
    handler.post(updateTimer)
  }

  private fun loadAppIcon(): Drawable? = runCatching {
    val drawable = packageManager.getApplicationIcon(blockedPackage)
    drawable.constantState?.newDrawable(resources)?.mutate() ?: drawable.mutate()
  }.getOrNull()

  private fun syncSession() {
    lastSyncElapsed = SystemClock.elapsedRealtime()
    val target = blockedPackage
    executor.execute {
      val session = runCatching { database.getEnforceableSession() }.getOrNull()
      val stillBlocked = session != null && session.blockedApps.any { it.packageName == target }
      val remaining = if (stillBlocked) {
        runCatching { database.remainingMillis(session!!) }.getOrDefault(0L)
      } else {
        0L
      }
      handler.post {
        if (isFinishing || isDestroyed || target != blockedPackage) return@post
        if (!stillBlocked || remaining <= 0L) {
          goHome()
        } else {
          endElapsed = SystemClock.elapsedRealtime() + remaining
          handler.removeCallbacks(updateTimer)
          handler.post(updateTimer)
        }
      }
    }
  }

  private fun buildContent(): View {
    val density = resources.displayMetrics.density
    fun dp(value: Int) = (value * density).toInt()
    fun rounded(color: Int, radius: Int, strokeColor: Int? = null, strokeWidth: Int = 0) =
      GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(radius).toFloat()
        setColor(color)
        if (strokeColor != null) setStroke(dp(strokeWidth), strokeColor)
      }
    fun text(
      value: CharSequence,
      size: Float,
      color: Int,
      weight: Int = Typeface.NORMAL,
    ) = TextView(this).apply {
      this.text = value
      textSize = size
      setTextColor(color)
      gravity = Gravity.CENTER
      setTypeface(typeface, weight)
      includeFontPadding = false
    }

    val root = FrameLayout(this).apply {
      setBackgroundColor(BACKGROUND)
      clipChildren = true
    }
    root.addView(BlockBackdropView(this), FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    ))

    val scroll = ScrollView(this).apply {
      isFillViewport = true
      isVerticalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(20), dp(20), dp(20), dp(30))
    }

    shieldView = FocusShieldView(this).apply {
      contentDescription = getString(R.string.block_title)
    }
    content.addView(shieldView, LinearLayout.LayoutParams(dp(214), dp(190)))

    content.addView(text(getString(R.string.block_mode_label), 11f, PRIMARY_LIGHT, Typeface.BOLD).apply {
      letterSpacing = 0.2f
      background = rounded(PILL_SURFACE, 50, PILL_BORDER, 1)
      setPadding(dp(20), dp(10), dp(20), dp(10))
    }, LinearLayout.LayoutParams(dp(214), dp(42)))

    val titleCopy = getString(R.string.block_title)
    val highlightedWord = "intention."
    val displayTitle = titleCopy.replace(" $highlightedWord", "\n$highlightedWord")
    val title = SpannableString(displayTitle).apply {
      val start = displayTitle.lastIndexOf(highlightedWord)
      if (start >= 0) {
        setSpan(
          ForegroundColorSpan(PRIMARY_LIGHT),
          start,
          displayTitle.length,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
      }
    }
    content.addView(text(title, 36f, Color.WHITE, Typeface.BOLD).apply {
      setLineSpacing(dp(1).toFloat(), 1f)
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(18)
    })

    val blockedAppRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    val iconFrame = FrameLayout(this).apply {
      background = rounded(APP_ICON_SURFACE, 17, APP_ICON_BORDER, 1)
    }
    appIconView = ImageView(this).apply {
      scaleType = ImageView.ScaleType.FIT_CENTER
      setPadding(dp(7), dp(7), dp(7), dp(7))
    }
    iconFrame.addView(appIconView, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    ))
    appIconFallback = text("", 16f, Color.WHITE, Typeface.BOLD)
    iconFrame.addView(appIconFallback, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    ))
    blockedAppRow.addView(iconFrame, LinearLayout.LayoutParams(dp(54), dp(54)).apply {
      marginEnd = dp(12)
    })
    appNameText = text("", 16f, TEXT_MUTED, Typeface.NORMAL).apply {
      gravity = Gravity.START or Gravity.CENTER_VERTICAL
      maxLines = 2
    }
    blockedAppRow.addView(appNameText, LinearLayout.LayoutParams(
      0,
      dp(58),
      1f,
    ))
    content.addView(blockedAppRow, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(14)
      marginStart = dp(14)
      marginEnd = dp(14)
    })

    val timerCard = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      background = rounded(SURFACE, 28, BORDER, 1)
      elevation = dp(10).toFloat()
      setPadding(dp(20), dp(24), dp(20), dp(22))
    }
    val timerLabel = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    timerLabel.addView(text("◷", 24f, PRIMARY_LIGHT, Typeface.BOLD), LinearLayout.LayoutParams(
      dp(28),
      dp(28),
    ).apply {
      marginEnd = dp(7)
    })
    timerLabel.addView(text(getString(R.string.block_remaining_label), 11f, TEXT_SUBTLE, Typeface.BOLD).apply {
      letterSpacing = 0.19f
    })
    timerCard.addView(timerLabel)

    timerText = text(getString(R.string.block_initial_timer), 48f, Color.WHITE, Typeface.NORMAL).apply {
      typeface = Typeface.MONOSPACE
      setPadding(0, dp(10), 0, dp(10))
      setTextIsSelectable(false)
    }
    timerCard.addView(timerText)
    timerCard.addView(View(this).apply {
      background = rounded(DIVIDER, 1)
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply {
      topMargin = dp(4)
      bottomMargin = dp(16)
    })

    val protectionRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    protectionRow.addView(text("✓", 12f, DARK_INK, Typeface.BOLD).apply {
      background = rounded(PRIMARY, 50)
    }, LinearLayout.LayoutParams(dp(25), dp(25)).apply {
      marginEnd = dp(9)
    })
    protectionRow.addView(text(getString(R.string.block_protection_note), 12.5f, TEXT_MUTED))
    timerCard.addView(protectionRow)
    content.addView(timerCard, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(22)
    })

    val homeButton = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      isClickable = true
      isFocusable = true
      elevation = dp(10).toFloat()
      background = RippleDrawable(
        ColorStateList.valueOf(Color.argb(42, 3, 15, 35)),
        rounded(PRIMARY, 32, PRIMARY_LIGHT, 1),
        null,
      )
      setOnClickListener { goHome() }
    }
    homeButton.addView(HomeGlyphView(this), LinearLayout.LayoutParams(dp(28), dp(28)).apply {
      marginEnd = dp(18)
    })
    homeButton.addView(View(this).apply {
      setBackgroundColor(Color.argb(64, 4, 22, 49))
    }, LinearLayout.LayoutParams(dp(1), dp(28)).apply {
      marginEnd = dp(18)
    })
    homeButton.addView(text(getString(R.string.block_home_button), 16f, DARK_BLUE, Typeface.BOLD))
    content.addView(homeButton, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      dp(64),
    ).apply {
      topMargin = dp(18)
    })

    val statusRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    statusRow.addView(View(this).apply {
      background = rounded(PRIMARY, 50)
    }, LinearLayout.LayoutParams(dp(10), dp(10)).apply {
      marginEnd = dp(9)
    })
    statusRow.addView(text(getString(R.string.block_native_status), 11.5f, TEXT_SUBTLE, Typeface.BOLD))
    content.addView(statusRow, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(18)
    })

    // The empty half of this screen is the only place in the app where a reason to
    // walk away is worth reading, so the quote lives here rather than on a splash.
    val quoteBlock = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(8), 0, dp(8), 0)
    }
    quoteText = text("", 14.5f, TEXT_MUTED, Typeface.NORMAL).apply {
      setLineSpacing(dp(5).toFloat(), 1f)
    }
    quoteAuthorText = text("", 11.5f, TEXT_SUBTLE, Typeface.BOLD)
    quoteBlock.addView(quoteText, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ))
    quoteBlock.addView(quoteAuthorText, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(10)
    })
    content.addView(quoteBlock, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(30)
      bottomMargin = dp(18)
    })

    scroll.addView(content, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    ))
    root.addView(scroll, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    ))
    return root
  }

  private fun goHome() {
    if (leaving) return
    leaving = true
    handler.removeCallbacks(updateTimer)
    runCatching {
      startActivity(Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      })
    }
    finishAndRemoveTask()
  }

  private fun formatRemaining(milliseconds: Long): String {
    val seconds = (milliseconds + 999L) / 1000L
    return String.format(
      Locale.US,
      "%02d:%02d:%02d",
      seconds / 3600L,
      (seconds % 3600L) / 60L,
      seconds % 60L,
    )
  }

  companion object {
    const val EXTRA_PACKAGE_NAME = "blocked_package"
    const val EXTRA_APP_NAME = "blocked_app_name"
    const val EXTRA_REMAINING_MILLIS = "blocked_remaining_millis"
    const val EXTRA_QUOTE_SEED = "blocked_quote_seed"
    private const val SYNC_INTERVAL_MILLIS = 5_000L

    private val BACKGROUND = Color.rgb(2, 9, 22)
    private val SURFACE = Color.argb(226, 10, 31, 63)
    private val BORDER = Color.rgb(47, 83, 139)
    private val DIVIDER = Color.argb(92, 94, 135, 190)
    private val PRIMARY = Color.rgb(255, 195, 22)
    private val PRIMARY_LIGHT = Color.rgb(255, 211, 65)
    private val PILL_SURFACE = Color.argb(224, 10, 35, 76)
    private val PILL_BORDER = Color.argb(95, 63, 112, 184)
    private val APP_ICON_SURFACE = Color.argb(230, 15, 47, 94)
    private val APP_ICON_BORDER = Color.argb(75, 91, 139, 204)
    private val DARK_INK = Color.rgb(13, 16, 13)
    private val DARK_BLUE = Color.rgb(4, 22, 49)
    private val TEXT_MUTED = Color.rgb(210, 219, 234)
    private val TEXT_SUBTLE = Color.rgb(153, 171, 199)

    @Volatile var isVisible: Boolean = false
      private set
  }
}

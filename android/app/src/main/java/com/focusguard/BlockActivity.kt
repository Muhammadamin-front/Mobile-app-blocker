package com.focusguard

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
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
  private lateinit var appInitialText: TextView
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
    appInitialText.text = appName.take(1).uppercase()
    appNameText.text = getString(R.string.block_app_message, appName)
    val remaining = intent.getLongExtra(EXTRA_REMAINING_MILLIS, 0L)
    endElapsed = SystemClock.elapsedRealtime() + remaining
    lastSyncElapsed = SystemClock.elapsedRealtime()
    timerText.text = formatRemaining(remaining)
    handler.removeCallbacks(updateTimer)
    handler.post(updateTimer)
  }

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
    }

    root.addView(View(this).apply {
      background = rounded(PRIMARY_GLOW, 120)
      alpha = 0.7f
    }, FrameLayout.LayoutParams(dp(240), dp(240), Gravity.TOP or Gravity.END).apply {
      topMargin = -dp(150)
      marginEnd = -dp(100)
    })

    val scroll = ScrollView(this).apply {
      isFillViewport = true
      overScrollMode = View.OVER_SCROLL_NEVER
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL or Gravity.CENTER_VERTICAL
      setPadding(dp(24), dp(32), dp(24), dp(32))
    }

    val brand = FrameLayout(this).apply {
      background = rounded(PRIMARY, 18)
      contentDescription = getString(R.string.app_name)
    }
    val brandOrbit = FrameLayout(this).apply {
      background = rounded(Color.TRANSPARENT, 50, Color.WHITE, 3)
    }
    brandOrbit.addView(View(this).apply {
      background = rounded(Color.WHITE, 50)
    }, FrameLayout.LayoutParams(dp(8), dp(8), Gravity.CENTER))
    brand.addView(brandOrbit, FrameLayout.LayoutParams(dp(32), dp(32), Gravity.CENTER))
    content.addView(brand, LinearLayout.LayoutParams(dp(58), dp(58)).apply {
      bottomMargin = dp(24)
    })

    content.addView(text(getString(R.string.block_mode_label), 11f, PRIMARY_LIGHT, Typeface.BOLD).apply {
      letterSpacing = 0.18f
      background = rounded(PRIMARY_SOFT, 50)
      setPadding(dp(14), dp(7), dp(14), dp(7))
    })
    content.addView(text(getString(R.string.block_title), 31f, Color.WHITE, Typeface.BOLD), LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(22)
    })

    val blockedAppRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(0, dp(14), 0, dp(4))
    }
    appInitialText = text("", 14f, Color.WHITE, Typeface.BOLD).apply {
      background = rounded(PRIMARY, 13)
    }
    blockedAppRow.addView(appInitialText, LinearLayout.LayoutParams(dp(38), dp(38)).apply {
      marginEnd = dp(10)
    })
    appNameText = text("", 16f, TEXT_MUTED, Typeface.NORMAL).apply {
      gravity = Gravity.START or Gravity.CENTER_VERTICAL
    }
    blockedAppRow.addView(appNameText, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      dp(44),
    ))
    content.addView(blockedAppRow)

    val timerCard = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      background = rounded(SURFACE, 26, BORDER, 1)
      setPadding(dp(20), dp(28), dp(20), dp(26))
    }
    timerCard.addView(text(getString(R.string.block_remaining_label), 10f, TEXT_SUBTLE, Typeface.BOLD).apply {
      letterSpacing = 0.17f
    })
    timerText = text(getString(R.string.block_initial_timer), 44f, Color.WHITE, Typeface.NORMAL).apply {
      typeface = Typeface.MONOSPACE
      setPadding(0, dp(12), 0, dp(12))
      setTextIsSelectable(false)
    }
    timerCard.addView(timerText)
    timerCard.addView(View(this).apply {
      background = rounded(BORDER, 1)
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply {
      topMargin = dp(8)
      bottomMargin = dp(18)
    })
    timerCard.addView(text(getString(R.string.block_protection_note), 12f, TEXT_MUTED, Typeface.NORMAL))
    content.addView(timerCard, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(28)
    })

    val homeButton = text(getString(R.string.block_home_button), 16f, Color.WHITE, Typeface.BOLD).apply {
      isClickable = true
      isFocusable = true
      background = RippleDrawable(
        ColorStateList.valueOf(Color.argb(38, 255, 255, 255)),
        rounded(PRIMARY, 17),
        null,
      )
      setOnClickListener { goHome() }
    }
    content.addView(homeButton, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      dp(58),
    ).apply {
      topMargin = dp(18)
    })

    val statusRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    statusRow.addView(View(this).apply {
      background = rounded(SUCCESS, 50)
    }, LinearLayout.LayoutParams(dp(7), dp(7)).apply {
      marginEnd = dp(8)
    })
    statusRow.addView(text(getString(R.string.block_native_status), 11f, TEXT_SUBTLE, Typeface.BOLD))
    content.addView(statusRow, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.WRAP_CONTENT,
      LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply {
      topMargin = dp(20)
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
    private const val SYNC_INTERVAL_MILLIS = 5_000L

    private val BACKGROUND = Color.rgb(12, 14, 22)
    private val SURFACE = Color.rgb(21, 24, 35)
    private val BORDER = Color.rgb(40, 45, 60)
    private val PRIMARY = Color.rgb(103, 88, 231)
    private val PRIMARY_LIGHT = Color.rgb(174, 165, 255)
    private val PRIMARY_SOFT = Color.rgb(41, 37, 69)
    private val PRIMARY_GLOW = Color.rgb(32, 28, 62)
    private val TEXT_MUTED = Color.rgb(178, 184, 202)
    private val TEXT_SUBTLE = Color.rgb(127, 135, 155)
    private val SUCCESS = Color.rgb(100, 218, 176)

    @Volatile var isVisible: Boolean = false
      private set
  }
}

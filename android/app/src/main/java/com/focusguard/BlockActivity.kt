package com.focusguard

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import java.util.Locale

class BlockActivity : ComponentActivity() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var database: FocusDatabase
  private lateinit var timerText: TextView
  private lateinit var appNameText: TextView
  private var blockedPackage: String = ""

  private val updateTimer = object : Runnable {
    override fun run() {
      val session = database.getEnforceableSession()
      if (session == null || session.blockedApps.none { it.packageName == blockedPackage }) {
        goHome()
        return
      }
      val remaining = database.remainingMillis(session)
      if (remaining <= 0L) {
        database.normalizeSessions()
        goHome()
        return
      }
      timerText.text = formatRemaining(remaining)
      handler.postDelayed(this, 500L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    database = FocusDatabase.get(this)
    blockedPackage = intent.getStringExtra(EXTRA_PACKAGE_NAME).orEmpty()
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
    handler.removeCallbacks(updateTimer)
    handler.post(updateTimer)
  }

  override fun onPause() {
    handler.removeCallbacks(updateTimer)
    super.onPause()
  }

  private fun applyIntent(intent: Intent) {
    blockedPackage = intent.getStringExtra(EXTRA_PACKAGE_NAME).orEmpty()
    val appName = intent.getStringExtra(EXTRA_APP_NAME).orEmpty().ifBlank { "This app" }
    appNameText.text = getString(R.string.block_app_message, appName)
    handler.removeCallbacks(updateTimer)
    handler.post(updateTimer)
  }

  private fun buildContent(): View {
    val density = resources.displayMetrics.density
    fun dp(value: Int) = (value * density).toInt()

    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(28), dp(32), dp(28), dp(32))
      setBackgroundColor(Color.rgb(12, 17, 29))

      addView(TextView(context).apply {
        text = getString(R.string.block_mode_label)
        setTextColor(Color.rgb(139, 140, 245))
        textSize = 13f
        gravity = Gravity.CENTER
        letterSpacing = 0.16f
        setTypeface(typeface, android.graphics.Typeface.BOLD)
      })
      addView(TextView(context).apply {
        text = getString(R.string.block_title)
        setTextColor(Color.WHITE)
        textSize = 30f
        gravity = Gravity.CENTER
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(18), 0, dp(12))
      })
      appNameText = TextView(context).apply {
        setTextColor(Color.rgb(178, 188, 208))
        textSize = 17f
        gravity = Gravity.CENTER
      }
      addView(appNameText)
      addView(TextView(context).apply {
        text = getString(R.string.block_remaining_label)
        setTextColor(Color.rgb(139, 140, 245))
        textSize = 12f
        gravity = Gravity.CENTER
        letterSpacing = 0.12f
        setPadding(0, dp(44), 0, dp(8))
      })
      timerText = TextView(context).apply {
        text = getString(R.string.block_initial_timer)
        setTextColor(Color.WHITE)
        textSize = 45f
        gravity = Gravity.CENTER
        typeface = android.graphics.Typeface.MONOSPACE
      }
      addView(timerText)
      addView(Button(context).apply {
        text = getString(R.string.block_home_button)
        isAllCaps = false
        textSize = 16f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(91, 92, 226))
        setPadding(dp(28), dp(4), dp(28), dp(4))
        setOnClickListener { goHome() }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply {
        topMargin = dp(48)
      })
    }
  }

  private fun goHome() {
    handler.removeCallbacks(updateTimer)
    startActivity(Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    })
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
  }
}

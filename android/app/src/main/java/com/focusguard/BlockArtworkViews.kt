package com.focusguard

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.view.View

/** Decorative, GPU-drawn background so the native blocking screen needs no bitmap assets. */
internal class BlockBackdropView(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
  }
  private val density = resources.displayMetrics.density

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val width = width.toFloat()
    val height = height.toFloat()

    paint.shader = RadialGradient(
      width * 0.5f,
      height * 0.42f,
      height * 0.55f,
      intArrayOf(Color.rgb(11, 36, 70), Color.rgb(4, 17, 36), Color.rgb(2, 9, 22)),
      floatArrayOf(0f, 0.52f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawRect(0f, 0f, width, height, paint)

    paint.shader = LinearGradient(
      width - 170f * density,
      0f,
      width,
      165f * density,
      Color.rgb(255, 216, 76),
      Color.rgb(211, 153, 23),
      Shader.TileMode.CLAMP,
    )
    canvas.drawCircle(width + 26f * density, -34f * density, 142f * density, paint)

    paint.shader = LinearGradient(
      0f,
      height - 200f * density,
      180f * density,
      height,
      Color.rgb(18, 53, 103),
      Color.rgb(7, 25, 57),
      Shader.TileMode.CLAMP,
    )
    canvas.drawCircle(-76f * density, height + 58f * density, 190f * density, paint)

    linePaint.shader = null
    linePaint.color = Color.rgb(255, 200, 20)
    linePaint.strokeWidth = 2f * density
    canvas.drawArc(
      RectF(-178f * density, height - 174f * density, 110f * density, height + 122f * density),
      278f,
      76f,
      false,
      linePaint,
    )
    canvas.drawArc(
      RectF(width - 98f * density, height - 112f * density, width + 142f * density, height + 128f * density),
      204f,
      84f,
      false,
      linePaint,
    )
  }
}

/** The shield artwork mirrors the product reference while rendering the actual blocked app icon. */
internal class FocusShieldView(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val shield = Path()
  private val iconClip = Path()
  private var icon: Drawable? = null
  private var fallbackLetter = "?"

  fun setBlockedApp(drawable: Drawable?, initial: String) {
    icon = drawable
    fallbackLetter = initial.ifBlank { "?" }
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val width = width.toFloat()
    val height = height.toFloat()
    val centerX = width / 2f
    val shieldTop = height * 0.08f
    val shieldBottom = height * 0.81f
    val shieldHalfWidth = width * 0.31f
    val centerY = height * 0.43f
    val ringRadius = width * 0.17f

    paint.shader = RadialGradient(
      centerX,
      centerY,
      width * 0.42f,
      intArrayOf(Color.argb(82, 255, 199, 16), Color.argb(22, 255, 199, 16), Color.TRANSPARENT),
      floatArrayOf(0f, 0.56f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawCircle(centerX, centerY, width * 0.42f, paint)

    paint.shader = LinearGradient(
      centerX,
      height * 0.74f,
      centerX,
      height * 0.94f,
      Color.argb(82, 255, 203, 35),
      Color.TRANSPARENT,
      Shader.TileMode.CLAMP,
    )
    canvas.drawOval(
      RectF(width * 0.22f, height * 0.76f, width * 0.78f, height * 0.91f),
      paint,
    )

    strokePaint.shader = null
    strokePaint.color = Color.rgb(255, 199, 20)
    strokePaint.strokeWidth = width * 0.038f
    canvas.drawLine(width * 0.12f, height * 0.37f, width * 0.20f, height * 0.41f, strokePaint)
    canvas.drawLine(width * 0.10f, height * 0.54f, width * 0.20f, height * 0.53f, strokePaint)
    canvas.drawLine(width * 0.80f, height * 0.41f, width * 0.88f, height * 0.37f, strokePaint)
    canvas.drawLine(width * 0.80f, height * 0.53f, width * 0.90f, height * 0.54f, strokePaint)

    shield.reset()
    shield.moveTo(centerX, shieldTop)
    shield.cubicTo(
      centerX - shieldHalfWidth * 0.46f,
      shieldTop + height * 0.12f,
      centerX - shieldHalfWidth,
      shieldTop + height * 0.14f,
      centerX - shieldHalfWidth,
      shieldTop + height * 0.25f,
    )
    shield.lineTo(centerX - shieldHalfWidth, height * 0.48f)
    shield.cubicTo(
      centerX - shieldHalfWidth,
      height * 0.66f,
      centerX - shieldHalfWidth * 0.48f,
      height * 0.76f,
      centerX,
      shieldBottom,
    )
    shield.cubicTo(
      centerX + shieldHalfWidth * 0.48f,
      height * 0.76f,
      centerX + shieldHalfWidth,
      height * 0.66f,
      centerX + shieldHalfWidth,
      height * 0.48f,
    )
    shield.lineTo(centerX + shieldHalfWidth, shieldTop + height * 0.25f)
    shield.cubicTo(
      centerX + shieldHalfWidth,
      shieldTop + height * 0.14f,
      centerX + shieldHalfWidth * 0.46f,
      shieldTop + height * 0.12f,
      centerX,
      shieldTop,
    )
    shield.close()

    paint.shader = LinearGradient(
      centerX - shieldHalfWidth,
      0f,
      centerX + shieldHalfWidth,
      0f,
      intArrayOf(Color.rgb(255, 224, 92), Color.rgb(255, 195, 24), Color.rgb(240, 166, 16)),
      floatArrayOf(0f, 0.52f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawPath(shield, paint)

    strokePaint.color = Color.rgb(255, 239, 172)
    strokePaint.strokeWidth = width * 0.009f
    canvas.drawPath(shield, strokePaint)

    paint.shader = null
    paint.color = Color.rgb(3, 15, 35)
    canvas.drawCircle(centerX, centerY, ringRadius * 1.22f, paint)

    iconClip.reset()
    iconClip.addCircle(centerX, centerY, ringRadius, Path.Direction.CW)
    canvas.save()
    canvas.clipPath(iconClip)
    val drawable = icon
    if (drawable != null) {
      drawable.setBounds(
        (centerX - ringRadius).toInt(),
        (centerY - ringRadius).toInt(),
        (centerX + ringRadius).toInt(),
        (centerY + ringRadius).toInt(),
      )
      drawable.draw(canvas)
    } else {
      paint.color = Color.rgb(31, 91, 174)
      canvas.drawCircle(centerX, centerY, ringRadius, paint)
      paint.color = Color.WHITE
      paint.textAlign = Paint.Align.CENTER
      paint.textSize = ringRadius
      paint.typeface = android.graphics.Typeface.DEFAULT_BOLD
      val baseline = centerY - (paint.descent() + paint.ascent()) / 2f
      canvas.drawText(fallbackLetter, centerX, baseline, paint)
    }
    canvas.restore()

    strokePaint.color = Color.rgb(255, 196, 0)
    strokePaint.strokeWidth = width * 0.048f
    canvas.drawLine(
      centerX - ringRadius * 0.79f,
      centerY + ringRadius * 0.79f,
      centerX + ringRadius * 0.79f,
      centerY - ringRadius * 0.79f,
      strokePaint,
    )
  }
}

internal class HomeGlyphView(context: Context) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.rgb(4, 22, 49)
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }
  private val path = Path()

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val width = width.toFloat()
    val height = height.toFloat()
    paint.strokeWidth = width * 0.11f
    path.reset()
    path.moveTo(width * 0.12f, height * 0.46f)
    path.lineTo(width * 0.5f, height * 0.14f)
    path.lineTo(width * 0.88f, height * 0.46f)
    path.moveTo(width * 0.22f, height * 0.4f)
    path.lineTo(width * 0.22f, height * 0.86f)
    path.lineTo(width * 0.43f, height * 0.86f)
    path.lineTo(width * 0.43f, height * 0.62f)
    path.lineTo(width * 0.62f, height * 0.62f)
    path.lineTo(width * 0.62f, height * 0.86f)
    path.lineTo(width * 0.78f, height * 0.86f)
    path.lineTo(width * 0.78f, height * 0.4f)
    canvas.drawPath(path, paint)
  }
}

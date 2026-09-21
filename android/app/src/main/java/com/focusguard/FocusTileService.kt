package com.focusguard

import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Starts and reads a focus session from the notification shade, so the common case —
 * "block my list for the usual half hour" — costs one tap instead of opening the app.
 *
 * A strict session is deliberately not offered here: committing to something you
 * cannot undo should take more than a shade tap.
 */
class FocusTileService : TileService() {
  private val worker = Executors.newSingleThreadExecutor()

  override fun onStartListening() {
    super.onStartListening()
    refresh()
  }

  override fun onClick() {
    super.onClick()
    val context = applicationContext
    worker.execute {
      try {
        val database = FocusDatabase.get(context)
        val current = database.getCurrentSession()
        if (current != null) {
          // An ordinary session stops; a strict one is left alone by design.
          if (!current.strict) {
            database.stopSession()
          }
        } else {
          startDefaultSession(database)
        }
        FocusAccessibilityService.invalidateCache()
        FocusNotifier.sync(context)
      } catch (error: Throwable) {
        Log.w(TAG, "Tile action failed.", error)
      }
      refresh()
    }
  }

  private fun startDefaultSession(database: FocusDatabase) {
    val apps = database.getSelectedApps()
    if (apps.isEmpty()) {
      return
    }
    val minutes = database.getSetting(FocusDatabase.TILE_DURATION_MINUTES)?.toIntOrNull()
      ?: DEFAULT_MINUTES
    val start = System.currentTimeMillis()
    database.startSession(
      id = "tile-" + UUID.randomUUID(),
      startTimestamp = start,
      endTimestamp = start + minutes * 60_000L,
      blockedApps = apps,
      strict = false,
    )
  }

  private fun refresh() {
    val context = applicationContext
    worker.execute {
      val state = try {
        val database = FocusDatabase.get(context)
        val session = database.getCurrentSession()
        when {
          session == null && database.getSelectedApps().isEmpty() -> TileState.UNAVAILABLE
          session == null -> TileState.OFF
          else -> TileState.ON
        }
      } catch (error: Throwable) {
        Log.w(TAG, "Could not read the session for the tile.", error)
        TileState.UNAVAILABLE
      }
      applyState(state)
    }
  }

  private fun applyState(state: TileState) {
    val tile = qsTile ?: return
    tile.state = when (state) {
      TileState.ON -> Tile.STATE_ACTIVE
      TileState.OFF -> Tile.STATE_INACTIVE
      TileState.UNAVAILABLE -> Tile.STATE_UNAVAILABLE
    }
    tile.label = getString(R.string.tile_label)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = getString(
        when (state) {
          TileState.ON -> R.string.tile_subtitle_on
          TileState.OFF -> R.string.tile_subtitle_off
          TileState.UNAVAILABLE -> R.string.tile_subtitle_unavailable
        },
      )
    }
    tile.icon = Icon.createWithResource(this, R.drawable.ic_notification)
    tile.updateTile()
  }

  override fun onDestroy() {
    worker.shutdown()
    super.onDestroy()
  }

  private enum class TileState { ON, OFF, UNAVAILABLE }

  companion object {
    private const val TAG = "FocusGuard"
    private const val DEFAULT_MINUTES = 30
  }
}

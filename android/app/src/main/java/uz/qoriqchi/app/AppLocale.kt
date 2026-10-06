package uz.qoriqchi.app

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

/**
 * The in-app language for the parts React Native does not draw. On Android 13+
 * AppCompatDelegate already hands the choice to the platform, but below that it only
 * reaches AppCompat activities — the block screen, the notification and the tile kept
 * the phone's language on a OnePlus running Android 12. Wrapping their context with
 * the stored choice makes them agree with the rest of the app on every version.
 */
object AppLocale {
  fun wrap(context: Context): Context {
    val language = runCatching {
      FocusDatabase.get(context).getSetting(FocusDatabase.LANGUAGE_PREFERENCE)
    }.getOrNull()
    if (language.isNullOrBlank() || language == "system") {
      return context
    }
    val config = Configuration(context.resources.configuration)
    config.setLocale(Locale(language))
    return context.createConfigurationContext(config)
  }
}

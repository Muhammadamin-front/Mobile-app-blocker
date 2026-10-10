# Qoriqchi

Qoriqchi is an Android-first, offline React Native focus app. Users choose launchable apps, schedule a focus session, and receive a native blocking screen when a selected app is opened. No account, backend, analytics SDK, or network service of its own is used; the one networked component is Google Play Billing, for the Pro purchase.

## Status and supported platform

- React Native 0.87.1 / React 19.2 / TypeScript
- Kotlin 2.2 / minimum Android API 24 / target API 36 / compile API 37
- Android MVP implemented; iOS is intentionally not implemented
- Qoriqchi's own code makes no network calls. The release manifest does carry `INTERNET` and `ACCESS_NETWORK_STATE`, merged in by Google's `datatransport` component, which Play Billing 8 uses for its own logging; debug builds also use them for Metro.

## Architecture

```text
React Native UI
  ├─ presentation/       onboarding, tabs, focus timer, picker, history, settings
  ├─ state/              application orchestration and app lifecycle refresh
  ├─ domain/             platform-neutral models and time rules
  └─ services/           AppBlockingService interface
          │
          └─ nativeAppBlockingService (Android adapter today, Swift adapter later)
                    │
Android/Kotlin
  ├─ QoriqchiModule           React Native bridge and launcher app discovery
  ├─ FocusDatabase              SQLite source of truth
  ├─ FocusAccessibilityService  package-level foreground detection/enforcement
  ├─ BlockActivity              non-exported native blocking UI
  └─ BootReceiver               reboot/time-change session normalization
```

The TypeScript layer only knows `AppBlockingService`. A future iOS adapter can implement the same operations using FamilyControls, ManagedSettings, and DeviceActivity without changing screens or application state.

SQLite is native intentionally: the accessibility service must restore and enforce sessions even when the React Native process does not exist. The database stores sessions, selected app metadata, settings, and blocked-open attempts in the app-private sandbox.

## Android enforcement choice

Qoriqchi uses a narrowly scoped `AccessibilityService` configured only for `TYPE_WINDOW_STATE_CHANGED`. It compares the event's package name with the active local block list and opens a non-exported native `BlockActivity`. It explicitly sets `canRetrieveWindowContent=false`; it never reads view trees, text, keystrokes, taps, messages, passwords, or screen content.

Why this mechanism:

- Usage Access can identify recent foreground packages but requires polling and can be delayed. It is not sufficient for a prompt blocker by itself.
- Device Policy suspension APIs are appropriate for device/profile owners, not a normal consumer installation.
- An overlay adds another sensitive permission and has poorer navigation/security behavior.
- A foreground service does not itself identify or prevent another foreground app, and newer Android versions restrict background starts.
- VPN/DNS blocking only affects network traffic and cannot block offline app use.

Android does not provide a public, unbypassable consumer API equivalent to managed enterprise app suspension. This design is a best-effort focus aid: the user can always disable Accessibility access or uninstall Qoriqchi, and Qoriqchi must not interfere with those controls.

Two limits are worth stating plainly, because both were observed on a device:

- **Force-stopping Qoriqchi disables its accessibility service.** Android clears the service from `enabled_accessibility_services` and does not rebind it; the user must re-enable it in Settings. Aggressive vendor battery managers can trigger the same path. Qoriqchi cannot prevent this, so instead it detects the lost permission and says so rather than showing a session it is no longer enforcing.
- **Background activity starts are not guaranteed.** Launching the block screen works on AOSP and Google builds, but some vendors restrict it further, which is why the service falls back to the home action.

Official references:

- [AccessibilityService API](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [Background activity launch restrictions](https://developer.android.com/guide/components/activities/secure-bal)
- [Package visibility declarations](https://developer.android.com/training/package-visibility/declaring)
- [Google Play Accessibility API policy](https://support.google.com/googleplay/android-developer/answer/10964491)
- [Google Play package visibility policy](https://support.google.com/googleplay/android-developer/answer/10158779)

## Permissions and visibility

Release permissions are deliberately minimal:

- `BIND_ACCESSIBILITY_SERVICE` is a system-only binding permission on the declared service. The user explicitly enables the service in Android Settings after a standalone in-app disclosure and affirmative consent.
- `RECEIVE_BOOT_COMPLETED` lets the app normalize persisted session state after reboot.
- `POST_NOTIFICATIONS` shows the session countdown; it is asked for when a session starts, and refusing it changes nothing else.
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE` keep the process — and the accessibility service in it — alive for the length of a session.
- `PACKAGE_USAGE_STATS` is optional and off by default; it powers only the screen-time breakdown, and the user grants it in Android Settings.
- `com.android.vending.BILLING` comes with Play Billing, for the one Pro purchase, and so do `INTERNET` and `ACCESS_NETWORK_STATE`: Play Billing 8 depends on Google's `datatransport` logging component, which declares them. Qoriqchi's own code opens no connection. Declare Play Billing in the Data safety form as Google's SDK requires.
- A scoped `<queries>` declaration discovers only activities matching `ACTION_MAIN` + `CATEGORY_LAUNCHER`, plus the Telegram packages, so the weekly card can be sent straight there.

Not requested: `QUERY_ALL_PACKAGES`, overlay, exact-alarm, device-admin, VPN, storage, location, contacts, or root. The app, current launcher, default dialer, Settings, System UI, package installer, and permission controller are excluded from selection.

## Google Play review checklist

This app is **not** an accessibility tool and declares `isAccessibilityTool=false`.

Before publishing:

1. Complete the Accessibility API declaration in Play Console and provide a short review video showing the disclosure, opt-in, Android setting, and blocking behavior.
2. Keep the standalone prominent disclosure and affirmative checkbox in the normal onboarding flow.
3. Describe Accessibility use in the store listing; do not imply the service assists users with disabilities.
4. State accurately that installed launcher-app metadata and session records remain local and are not sold, shared, or transmitted.
5. Complete Data safety based on the final artifact and every added dependency. The current project has no analytics or advertising SDK.
6. Do not add `QUERY_ALL_PACKAGES` unless Play has approved a genuinely eligible core use. This project uses a scoped launcher intent instead.
7. Re-submit the declaration if the service behavior changes.

Accessibility approval is a policy review, not a technical guarantee. Google Play can reject uses it considers insufficiently justified, so the listing, disclosure, demo video, and implementation must remain aligned.

## Statistics

The Progress tab reads one native query per range. `getTrends(week|month|year)`
returns the bucketed focus time, the counts for that window, and the five apps
opened against the block list most often in it.

- Buckets are built in local time at query time, so a time-zone change moves the
  boundaries with the user instead of leaving the chart on the old offset.
- A session is split across the days or months it actually covers rather than
  being credited entirely to the day it started.
- Focus time is measured, not planned: `ended_at` records when a session really
  stopped protecting time, a running session counts up to now, and a scheduled
  one counts for nothing. The all-time total uses the same rule, so it can never
  contradict the window shown above it.
- The bucketing arithmetic lives in `FocusTrendMath`, free of Android and
  SQLite, and is unit tested directly.

The chart is one series on one baseline: thin bars with a 2px surface gap, a
recessive hairline grid, labels placed from a measured layout so a dense month
never clips them, and a tap readout that supplements the axis rather than being
the only way to read a value.

## Keeping enforcement alive on aggressive phones

Tested on a OnePlus 7 Pro (Android 12): recents → "Close all" killed the process,
and Android did not rebind the accessibility service — blocked apps opened freely
while the session still showed as active. A foreground service now runs for the
length of each session, carrying the timer notification. After the change, "Close
all" killed Chrome but left Qoriqchi's process and its accessibility binding intact.

- `FocusSessionService` owns no logic: it shows FocusNotifier's notification and
  stops itself the moment there is no session. On Android 14+ it is declared
  `specialUse`, which needs a Play Console justification.
- If Android refuses a foreground start (some background contexts on 12+), the
  plain notification is posted instead, so the timer is never lost.
- The app also asks — never forces — the user to exempt it from battery
  optimisation, and on vendors known for task killers suggests locking it in
  recents. It does not request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which Play
  restricts; it opens the settings screen instead.

## Reading instead of scrolling

The block screen can show English words or a book instead of the countdown: each
reach for a blocked app becomes a little study. "No book" keeps the timer and quote.

- **English words.** Five cards per visit from a deck of 994 words — NGSL 1.2 ranks
  1001–2000, the B1–B2 band IELTS and CEFR preparation lives in. A card shows the
  word and a plain-English definition; the Uzbek meaning appears only when asked for,
  so each card is recall, not reading. "I know it" moves the word up a Leitner box
  (back in 1, 3, 7, 16, 35, then 90 days); "Show again" brings it back in ten
  minutes. `WordScheduler` is unit tested. The deck is built by
  `scripts/build_words.py` from the NGSL (CC BY-SA 4.0) and the Uzbek glosses in
  `scripts/words/uz_glosses.tsv`, written for this app and shared under the same
  license. A handful of words unsuited to a student audience were left out.
- **Books.** All public domain under Uzbek law (life + 50 years): Abdulla Qodiriy's
  *O'tkan kunlar*, Cho'lpon's *Kecha va kunduz*, Abdulla Avloniy's *Turkiy Guliston
  yoxud axloq*, and *Jadid she'riyati*, poems by Cho'lpon, Fitrat, Avloniy, Hamza and
  Qodiriy (all died by 1938). The text comes from Wikisource via
  `scripts/fetch_books.py` (`--skip-novels` refreshes only the shorter works), which
  strips the site's navigation and licence box, keeps chapter names, and keeps the
  line breaks of verse; Wikisource is credited in the app.
- `BookPager` splits chapters into pages that fit one phone screen, ending on a
  paragraph, a sentence or a word, never mid-word. It is unit tested.
- Progress and "pages read" are stored locally. Only a page never reached before
  counts, so paging back and forth does not inflate the total.
- Leaving is always possible: Back and "Back to Home" work on every page. The book
  replaces the blocked app; it does not trap the user.

## The mark

The logo is a Q made of the session ring with a bookmark ribbon for its tail: the
session holds, and reaching for a blocked app opens a book. Every rendition — the
adaptive launcher icon (also used as the Android 13 themed-icon layer), the
pre-adaptive icons, the status bar and tile icon, and the in-app mark — is generated
from one geometry by `scripts/brand/gen_mark.py`. Edit the numbers there and run it
with `--png` (needs Google Chrome and Pillow) rather than editing the drawables.

## The session timer outside the app

While a session runs, the remaining time sits in the status bar and on the lock
screen so the user never has to reopen Qoriqchi to check it.

- The countdown is handed to the system as a chronometer, so it keeps ticking
  with the process idle and costs nothing to redraw.
- The notification is carried by the session's foreground service (see above).
- The channel is silent by design but carries default importance, because
  Android files low-importance notifications away from the lock screen, which is
  exactly where this one is meant to be. Sound and vibration are removed instead.
- It is posted when a session starts, retired when one ends, restored after a
  reboot, and re-synced by the accessibility service and an inexact alarm, so it
  can neither go missing nor linger at zero.
- `POST_NOTIFICATIONS` is requested at the moment the session starts, where the
  reason is on screen. Refusing it does not affect blocking; the session simply
  runs without a visible timer.

## Strict sessions

A session can be started strict, and then it cannot be ended early. The button is
not disabled — it is not there, replaced by a card that says why.

- The refusal lives in the database, not only in the UI: `stopSession` throws while
  a strict session still has time left, so nothing that reaches the native layer can
  end it either.
- It is confirmed before it starts, because it is the one choice on that screen that
  cannot be taken back.
- It never obstructs Android itself. Disabling the accessibility service or
  uninstalling the app still works, and the onboarding says so. Using Accessibility
  to stop that would also break Play policy for anything that is not a parental
  control.
- It is the paid feature, Qoriqchi Pro: one non-consumable in-app product,
  `qoriqchi_pro`, bought through Play Billing 8. The entitlement is cached in the
  local database, so strict sessions keep working offline; the session code asks
  `ProStore`, never Play. Every refresh writes Play's answer first, which is how a
  refund takes Pro away again. The rule is enforced natively too — starting a strict
  session or saving a strict schedule without Pro is refused below the UI, and a
  strict schedule saved under Pro runs as an ordinary one after a refund. Debug
  builds simulate the purchase, because there is no Play listing to buy from.
  Before release, create `qoriqchi_pro` in Play Console → Monetize → In-app products.

## Streaks and honest accounting

Strictness here is accountability, not a trap. A day counts toward the streak when a
session of at least 15 minutes ran to its end with protection on the whole time.

- `SessionIntegrity` reads the user's Accessibility setting — not whether the service
  is bound at that instant, so a reboot or an OEM killing the process is never
  mistaken for switching protection off. The foreground service watches the setting
  while a session runs, and the app's eight-second permission poll is a second check.
- When protection is found off, the session is marked broken (`broken_at`, the first
  moment only). It keeps blocking if protection comes back, but it no longer counts,
  and a broken session resets the day's streak even if another session that day
  finished cleanly. The notification and the active screen say so; the history shows
  the session as broken.
- `StreakMath` is unit tested, including local-midnight day boundaries.

## Exam countdown

A student sets the exam they are counting down to — DTM, final exams (attestatsiya),
IELTS, CEFR or their own — and the date, through Android's own date picker. The
block screen then says "DTMgacha 87 kun qoldi" right under the blocked app's name:
the number is the argument for closing it. Home shows the same countdown; schedules
offer one-tap study blocks (lessons Mon–Sat 8:00, homework daily 19:00, exam prep
Mon–Sat 16:00), each editable after.

## Sharing a week

The History screen draws a 1080×1350 card — focus time over the last 7 days, the
streak, pages read and words reviewed, the exam countdown — natively in `ShareCard`
and hands it to Android's share sheet, straight to Telegram when it is installed.
It needs no internet permission: the picture goes only where the person sends it,
through a `FileProvider` that exposes nothing but that one cached file. The caption
carries the Play link only once the app was installed from Play.

## Quick Settings tile

`FocusTileService` starts and stops a session from the notification shade, using the
saved app list and a default duration, so the common case costs one tap.

- With no apps chosen the tile reports itself unavailable rather than failing.
- It will not end a strict session: committing to something you cannot undo should
  take more than a shade tap.

## Schedules

A schedule is a row: which days, what time, how long, and whether it starts strict.
It blocks the saved app list rather than carrying its own, so editing the list
changes every schedule at once — which is what people mean by "my distractions".

- Days are a bitmask, Monday at bit 0 through Sunday at bit 6, and the arithmetic
  that answers "when does this fire next" lives in `ScheduleMath`, free of Android
  and SQLite so it is unit tested directly rather than by waiting for a clock.
- One inexact alarm is kept for the soonest upcoming start; when it fires, the
  schedule that is due starts a session and the next alarm is armed. Inexact costs
  the user no permission to grant, and a focus block that begins a minute late is
  still a focus block.
- A session already running wins: a schedule never interrupts focus that is under
  way, and never ends a strict one.
- The alarm is re-armed on boot, on every schedule edit, when a session starts, and
  when the module initializes, so it survives a reinstall or a cleared app.

## Two languages

The app ships in English and Uzbek, and the choice is one setting rather than two
mechanisms.

- The React Native layer translates through `src/i18n`, keyed by the English
  string. A missing entry falls back to that English, so a copy change on one side
  degrades to readable rather than to a raw key on screen.
- The native side keeps its own `values/` and `values-uz/` resources, including the
  block-screen quotes.
- Choosing a language calls `AppCompatDelegate.setApplicationLocales`, so the block
  screen and the timer notification follow the in-app choice instead of the phone's
  language. The stored choice is re-applied when the module initializes, and
  `locales_config.xml` also exposes the per-app language picker in Android 13+
  system settings.
- The brand name, the countdown format, and the `h`/`m` abbreviations are marked
  `translatable="false"` or left as they are: they carry no language.

## Screen time (optional)

`PACKAGE_USAGE_STATS` is declared but never required. Blocking, sessions, history,
and the focus chart all work without it; granting it only adds the per-app
breakdown on the Progress tab.

- The user turns it on themselves in Android's usage access screen, after an
  in-app explanation, and can withdraw it at any time. The UI reads the real
  AppOps state rather than remembering an answer.
- Foreground time is read with `UsageStatsManager` over the same window as the
  chart. Android keeps less detail the further back a window reaches, so a long
  range shows the best it can still account for, and the UI says so.
- Qoriqchi's own package is left out: time spent reading the report is not a
  distraction.
- Nothing read here is stored, aggregated over time, or transmitted. It is
  queried on demand and rendered.

For Play, this is a separate declaration from the Accessibility one: usage access
is a sensitive permission, so the store listing and Data safety form must describe
it as an optional, local-only statistics feature.

## Reliability behavior

- The native database is written before a session is returned to React Native.
- Database synchronization rejects simultaneous active/scheduled sessions, protecting against repeated Start taps.
- Enforcement does not use the JavaScript timer.
- On the same boot, `SystemClock.elapsedRealtime()` controls start and expiry, resisting timezone and ordinary wall-clock changes.
- After reboot, persisted epoch timestamps are the fallback because elapsed realtime resets, so time spent powered off is deducted from the session: rebooting cannot pause or extend a session.
- Enforcement resumes on its own after a reboot. Android re-binds an enabled accessibility service without the app being opened, and delivers the current window's state to it on connect, so an app already in the foreground is caught immediately rather than on the next switch.
- There is a window between boot and that re-bind during which nothing is enforced; it belongs to Android's scheduling and an app cannot bind its own accessibility service. Measured on a cold emulator boot, the service was bound 17 seconds before the keyguard could be dismissed, so the phone was not usable before enforcement was live. Confirm the ordering on real hardware.
- The service normalizes expiry on every relevant foreground event; the UI and boot/time receiver also normalize persisted state.
- Missing/corrupt selected-app JSON falls back to an empty list. An uninstalled blocked app remains harmless in history and no longer emits events.
- Revoking Accessibility access is always respected. The UI verifies actual enabled-service state whenever it returns to the foreground, and re-checks it on a timer while a session is running so a session can never be presented as enforced when it is not.
- Starting a session is refused natively unless the accessibility service is actually enabled.
- The service keeps an in-memory session snapshot, so a window change costs no database work, and the snapshot is invalidated whenever the session changes or is about to expire.
- Every enforcement step is wrapped: a failure logs and retries on the next window change rather than taking the process down.
- If Android refuses the background activity start, the service falls back to sending the user to the home screen, and it verifies that the block screen actually reached the foreground.
- Apps uninstalled after being selected are pruned from the stored selection.
- App icons are loaded from the package manager on demand and never written to the database.

## Project structure

```text
src/
  domain/models.ts
  domain/session.ts
  services/AppBlockingService.ts
  services/nativeAppBlockingService.ts
  state/AppStore.tsx
  theme/theme.ts
  presentation/AppShell.tsx
  presentation/components.tsx
  presentation/screens/
android/app/src/main/
  AndroidManifest.xml
  java/com/focusguard/
  res/xml/focus_accessibility_service.xml
__tests__/
```

## Development

Prerequisites: Node 22.11+, JDK 17, Android SDK 36/37.0, Build Tools 37.0.0, and the configured NDK.

```bash
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
cd android && ./gradlew assembleDebug
```

Install with `npm run android`, complete the in-app disclosure, then enable **Qoriqchi app blocking** in Android Accessibility settings.

### Sideloading a release build for testing

A debug APK expects a running Metro server and will not work on someone else's phone; build and share a signed release APK instead. Because the upload key is unknown to Google, Play Protect usually blocks the first install: the tester taps **More details → Install anyway**, or temporarily turns off Play Protect scanning in the Play Store.

## Manual Android test checklist

Run on at least one AOSP/Pixel device and representative Samsung/Xiaomi devices because vendors alter background/task behavior.

- [ ] Deny/leave Accessibility disabled: Start remains unavailable and UI never claims access is enabled.
- [ ] Accept disclosure and enable the named service; returning to the app automatically verifies it.
- [ ] Confirm the app picker shows launchable apps with icon, name, package, search, multi-select, Select all, and Clear.
- [ ] Confirm Qoriqchi, Settings, the launcher, default dialer, and core permission/system packages are absent.
- [ ] Start a 15-minute session; rapidly tap Start and verify only one session exists.
- [ ] Open a blocked app; verify the native screen appears promptly with the correct app name and countdown.
- [ ] Press Back and **Back to Home**; both go to the launcher without revealing a usable blocked app.
- [ ] Repeatedly select the blocked app from Recents; verify no crash or activity loop.
- [ ] Open an allowed app and verify it remains usable.
- [ ] Swipe Qoriqchi away from Recents (do not force-stop); open a blocked app and verify enforcement continues.
- [ ] Force-stop Qoriqchi from App info; confirm Android disables the accessibility service, that blocking stops, and that Qoriqchi reports the lost permission instead of claiming the session is still enforced.
- [ ] Reopen Qoriqchi and verify the active session and countdown restore.
- [ ] Change timezone and wall clock during a session; verify same-boot expiry follows elapsed time.
- [ ] Reboot during a session; verify the session restores, that a blocked app still opens into the block screen without reopening Qoriqchi, that the timer notification comes back, and that the time spent rebooting was deducted from the session.
- [ ] Let the session expire while outside Qoriqchi; verify the formerly blocked app opens.
- [ ] Revoke Accessibility during a session; verify Android accepts the revocation and Qoriqchi reports it disabled on return.
- [ ] Uninstall a blocked app; verify Qoriqchi remains stable and history is readable.
- [ ] Test light/dark/system themes and Reset local data.
- [ ] Start a strict session and confirm there is no way to end it in the app, that the tile refuses too, and that Accessibility can still be disabled from Android settings.
- [ ] Add the Quick Settings tile and confirm it starts, stops, and reports unavailable with no apps chosen.
- [ ] Save a schedule a few minutes ahead, lock the phone, and confirm the session starts on its own; then confirm a second schedule does not interrupt it.
- [ ] Switch the language and confirm the tab bar, both confirmation dialogs, the block screen, and the timer notification all follow it — including after force-stopping and reopening.
- [ ] Start a session, leave the app, and confirm the countdown is readable in the status bar, the shade, and the lock screen, and that it never makes a sound.
- [ ] End the session and confirm the notification and its status bar icon both disappear.
- [ ] Deny the notification permission and confirm the session still starts, blocks, and expires normally.
- [ ] Open Progress and switch Week/Month/Year; confirm the axis labels are never clipped, tapping a bar names it, and the all-time total is consistent with the selected window.
- [ ] Run a session across midnight and confirm it is split across both days.
- [ ] Upgrade over an older install and confirm the `ended_at` migration keeps existing history readable.
- [ ] Leave usage access off and confirm Progress shows the explanation, never an empty breakdown, and that blocking is unaffected.
- [ ] Grant usage access, confirm the per-app breakdown appears and follows the selected range, then revoke it and confirm the section returns to the explanation.
- [ ] Without Pro, tap Strict session on Home and in a schedule: the Pro sheet opens, a sideloaded build explains that Pro is sold only in the Play version, and the native layer refuses a strict start or a strict schedule.
- [ ] From an internal-testing install, buy `qoriqchi_pro` with a licence tester, confirm strict unlocks, then refund it in Play Console and confirm the next launch locks strict again.
- [ ] During a session, turn Accessibility off in Settings: within a few seconds the notification says the session will not count, Home shows "This session is broken", and History marks it; turning protection back on resumes blocking.
- [ ] Finish a 15-minute session and confirm the streak shows 1 and "today counts"; break the next one and confirm the streak returns to 0.
- [ ] Set an exam date with the date picker; confirm Home and the block screen show the days left, the day before says "tomorrow", and a passed exam disappears from the block screen.
- [ ] Tap each study preset once; it appears as a schedule and is not offered again.
- [ ] Choose English words, open a blocked app, reveal and answer five cards, then "5 more words"; a word marked "Show again" returns within ten minutes.
- [ ] Choose *Jadid she'riyati* and confirm poems keep their line breaks and stanzas on the block screen.
- [ ] Share from History: the card shows this week's numbers in the app's language; with Telegram installed, "Share on Telegram" opens it directly.
- [ ] Inspect the release manifest (`aapt2 dump permissions`) and confirm it has no `QUERY_ALL_PACKAGES`, and that `INTERNET` comes only from Play Billing's `datatransport` (see the manifest merger report).

## Release signing

The release build enables R8 and resource shrinking. It never falls back to the debug key. Supply an upload keystore through local Gradle properties or environment variables (do not commit secrets):

```properties
FOCUSGUARD_UPLOAD_STORE_FILE=/absolute/path/to/focusguard-upload.keystore
FOCUSGUARD_UPLOAD_STORE_PASSWORD=...
FOCUSGUARD_UPLOAD_KEY_ALIAS=focusguard-upload
FOCUSGUARD_UPLOAD_KEY_PASSWORD=...
```

Create a private upload key once, back it up securely, then build:

```bash
cd android
./gradlew clean bundleRelease
```

The signed app bundle is written under `android/app/build/outputs/bundle/release/`. Without all four signing values Gradle can still compile an unsigned release artifact for CI verification, but it is not publishable.

Before upload, increment `versionCode`, update `versionName`, run the full automated and manual checks, inspect the merged release manifest, test the minified build on-device, and enroll in Play App Signing.

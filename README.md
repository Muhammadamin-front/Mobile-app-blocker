# FocusGuard

FocusGuard is an Android-first, completely offline React Native focus app. Users choose launchable apps, schedule a focus session, and receive a native blocking screen when a selected app is opened. No account, backend, analytics SDK, or network service is used.

## Status and supported platform

- React Native 0.87.1 / React 19.2 / TypeScript
- Kotlin 2.2 / minimum Android API 24 / target API 36 / compile API 37
- Android MVP implemented; iOS is intentionally not implemented
- Debug builds use `INTERNET` only for Metro. The release manifest has no internet permission.

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
  ├─ FocusGuardModule           React Native bridge and launcher app discovery
  ├─ FocusDatabase              SQLite source of truth
  ├─ FocusAccessibilityService  package-level foreground detection/enforcement
  ├─ BlockActivity              non-exported native blocking UI
  └─ BootReceiver               reboot/time-change session normalization
```

The TypeScript layer only knows `AppBlockingService`. A future iOS adapter can implement the same operations using FamilyControls, ManagedSettings, and DeviceActivity without changing screens or application state.

SQLite is native intentionally: the accessibility service must restore and enforce sessions even when the React Native process does not exist. The database stores sessions, selected app metadata, settings, and blocked-open attempts in the app-private sandbox.

## Android enforcement choice

FocusGuard uses a narrowly scoped `AccessibilityService` configured only for `TYPE_WINDOW_STATE_CHANGED`. It compares the event's package name with the active local block list and opens a non-exported native `BlockActivity`. It explicitly sets `canRetrieveWindowContent=false`; it never reads view trees, text, keystrokes, taps, messages, passwords, or screen content.

Why this mechanism:

- Usage Access can identify recent foreground packages but requires polling and can be delayed. It is not sufficient for a prompt blocker by itself.
- Device Policy suspension APIs are appropriate for device/profile owners, not a normal consumer installation.
- An overlay adds another sensitive permission and has poorer navigation/security behavior.
- A foreground service does not itself identify or prevent another foreground app, and newer Android versions restrict background starts.
- VPN/DNS blocking only affects network traffic and cannot block offline app use.

Android does not provide a public, unbypassable consumer API equivalent to managed enterprise app suspension. This design is a best-effort focus aid: the user can always disable Accessibility access or uninstall FocusGuard, and FocusGuard must not interfere with those controls.

Two limits are worth stating plainly, because both were observed on a device:

- **Force-stopping FocusGuard disables its accessibility service.** Android clears the service from `enabled_accessibility_services` and does not rebind it; the user must re-enable it in Settings. Aggressive vendor battery managers can trigger the same path. FocusGuard cannot prevent this, so instead it detects the lost permission and says so rather than showing a session it is no longer enforcing.
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
- A scoped `<queries>` declaration discovers only activities matching `ACTION_MAIN` + `CATEGORY_LAUNCHER`.

Not requested: `QUERY_ALL_PACKAGES`, Usage Access, overlay, notification, exact-alarm, device-admin, VPN, storage, location, contacts, or root. The app, current launcher, default dialer, Settings, System UI, package installer, and permission controller are excluded from selection.

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
- FocusGuard's own package is left out: time spent reading the report is not a
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
- After reboot, persisted epoch timestamps are the fallback because elapsed realtime resets.
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

Install with `npm run android`, complete the in-app disclosure, then enable **FocusGuard app blocking** in Android Accessibility settings.

### Sideloading a release build for testing

A debug APK expects a running Metro server and will not work on someone else's phone; build and share a signed release APK instead. Because the upload key is unknown to Google, Play Protect usually blocks the first install: the tester taps **More details → Install anyway**, or temporarily turns off Play Protect scanning in the Play Store.

## Manual Android test checklist

Run on at least one AOSP/Pixel device and representative Samsung/Xiaomi devices because vendors alter background/task behavior.

- [ ] Deny/leave Accessibility disabled: Start remains unavailable and UI never claims access is enabled.
- [ ] Accept disclosure and enable the named service; returning to the app automatically verifies it.
- [ ] Confirm the app picker shows launchable apps with icon, name, package, search, multi-select, Select all, and Clear.
- [ ] Confirm FocusGuard, Settings, the launcher, default dialer, and core permission/system packages are absent.
- [ ] Start a 15-minute session; rapidly tap Start and verify only one session exists.
- [ ] Open a blocked app; verify the native screen appears promptly with the correct app name and countdown.
- [ ] Press Back and **Back to Home**; both go to the launcher without revealing a usable blocked app.
- [ ] Repeatedly select the blocked app from Recents; verify no crash or activity loop.
- [ ] Open an allowed app and verify it remains usable.
- [ ] Swipe FocusGuard away from Recents (do not force-stop); open a blocked app and verify enforcement continues.
- [ ] Force-stop FocusGuard from App info; confirm Android disables the accessibility service, that blocking stops, and that FocusGuard reports the lost permission instead of claiming the session is still enforced.
- [ ] Reopen FocusGuard and verify the active session and countdown restore.
- [ ] Change timezone and wall clock during a session; verify same-boot expiry follows elapsed time.
- [ ] Reboot during a session; verify the session restores and expires using persisted epoch time.
- [ ] Let the session expire while outside FocusGuard; verify the formerly blocked app opens.
- [ ] Revoke Accessibility during a session; verify Android accepts the revocation and FocusGuard reports it disabled on return.
- [ ] Uninstall a blocked app; verify FocusGuard remains stable and history is readable.
- [ ] Test light/dark/system themes and Reset local data.
- [ ] Open Progress and switch Week/Month/Year; confirm the axis labels are never clipped, tapping a bar names it, and the all-time total is consistent with the selected window.
- [ ] Run a session across midnight and confirm it is split across both days.
- [ ] Upgrade over an older install and confirm the `ended_at` migration keeps existing history readable.
- [ ] Leave usage access off and confirm Progress shows the explanation, never an empty breakdown, and that blocking is unaffected.
- [ ] Grant usage access, confirm the per-app breakdown appears and follows the selected range, then revoke it and confirm the section returns to the explanation.
- [ ] Inspect the release manifest and confirm it has no `INTERNET` or `QUERY_ALL_PACKAGES` permission.

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

# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Students and school pupils (roughly 15–25) in Uzbekistan who lose study time to their phone — during lessons, homework and exam preparation — and want something firmer than their own willpower. They use it on their own phone, for themselves; it is not a parental-control product.

## Product Purpose

Qoriqchi ("guardian") blocks the apps a student picks for a chosen time, so that opening one shows Qoriqchi instead. Success is a session that holds: the student meant to study for an hour, and the phone did not let them drift.

## Positioning

Strictness. A session can be made impossible to end early, enforcement survives the app being closed, the phone rebooting and OEM "close all", and the app tells the truth when it cannot enforce. Rivals let you talk your way out; Qoriqchi is the one that holds the line — honestly, never by trapping the user or fighting Android.

## Operating Context

- Started from the home screen, a Quick Settings tile, or a weekly schedule (e.g. weekdays 9:00, 1 hour).
- The moment that defines the product is the block screen: the student reaches for Instagram/Telegram/TikTok and gets Qoriqchi instead — optionally the next page of an Uzbek classic.
- Used offline; on mid-range Android phones including aggressive-OEM devices (tested on a OnePlus 7 Pro, Android 12).
- Bilingual: Uzbek and English, following the phone or an in-app choice.

## Capabilities and Constraints

- App blocking via a narrowly scoped AccessibilityService (package names only, no screen content); strict sessions; schedules; Quick Settings tile; timer on lock screen and status bar via a foreground service; statistics; optional screen-time breakdown.
- Bundled public-domain books: *O'tkan kunlar* (Abdulla Qodiriy) and *Kecha va kunduz* (Cho'lpon), from Wikisource.
- Offline: no account, no backend, no analytics, no ads. The one networked part is Google Play Billing for the Pro purchase (its library declares INTERNET); the app's own code makes no network calls.
- The user can always disable the service or uninstall; the product never obstructs Android's own controls.
- Monetization: a one-time Pro purchase (`qoriqchi_pro`) unlocks strict sessions and strict schedules; everything else is free.
- Undecided: whether the black cat from the intro is a brand mascot.

## Brand Commitments

- Name: **Qoriqchi** (written without an apostrophe so it searches as one word). Package `uz.qoriqchi.app`.
- Undecided: the intro's black-cat illustration (`src/assets/cat-intro.jpg`) is not yet confirmed as part of the identity.

## Evidence on Hand

- Real-device test results on a OnePlus 7 Pro (README, commit history).
- No users, reviews, testimonials, install counts or press exist yet. Do not invent them.

## Product Principles

1. The session holds. Firmness is the product; every feature is judged by whether it makes a session harder to escape without being dishonest about it.
2. Tell the truth. Never show protection that is not actually running.
3. Replace the urge, do not just refuse it — a page of a book beats a wall.
4. Offline and private by default; the student's lists, sessions and progress never leave the phone.
5. Built for a student's phone and language first: Uzbek, mid-range Android, real OEM behaviour.

## Accessibility & Inclusion

Uzbek and English throughout, including native screens. Text contrast at least WCAG AA; respect system font scale and Remove animations.

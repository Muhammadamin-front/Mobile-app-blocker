import {LanguagePreference} from '../i18n';

export type ThemePreference = 'system' | 'light' | 'dark';
export type {LanguagePreference};
export type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'STOPPED';

export interface InstalledApp {
  packageName: string;
  appName: string;
  iconBase64?: string;
}

export interface FocusSession {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  blockedApps: InstalledApp[];
  status: SessionStatus;
  /** A strict session refuses to be ended before it finishes. */
  strict: boolean;
  completedReason?: string;
  blockedAttempts: number;
  /** When protection was found off during the session. It then never counts toward a streak. */
  brokenAt?: number;
  /** Native monotonic snapshots used for clock-change-resistant UI countdowns. */
  remainingMillis?: number;
  startsInMillis?: number;
}

export interface PermissionStatus {
  accessibilityEnabled: boolean;
  /** Optional: powers the screen-time breakdown only, never blocking. */
  usageAccessEnabled: boolean;
  /** Exempt from battery optimisation, so OEM task killers leave sessions alone. */
  batteryUnrestricted: boolean;
  /** Lower-cased Build.MANUFACTURER, for vendor-specific advice. */
  manufacturer: string;
  ready: boolean;
}

export interface AppSettings {
  onboardingCompleted: boolean;
  themePreference: ThemePreference;
  language: LanguagePreference;
  /** What the phone is set to, so 'system' resolves without guessing. */
  deviceLanguage?: string;
}

export interface FocusStats {
  completedSessions: number;
  totalFocusMillis: number;
  totalBlockedAttempts: number;
  attemptsByPackage: Array<{
    packageName: string;
    appName: string;
    attempts: number;
  }>;
}

export interface StartSessionInput {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  blockedApps: InstalledApp[];
  strict: boolean;
}

/** Days in a row with a finished, unbroken session of at least `minMinutes`. */
export interface Streak {
  current: number;
  best: number;
  todayDone: boolean;
  minMinutes: number;
}

export type TrendRange = 'week' | 'month' | 'year';

export interface FocusBucket {
  label: string;
  startTimestamp: number;
  focusMillis: number;
}

export interface AppAttempt {
  packageName: string;
  appName: string;
  attempts: number;
}

export interface FocusTrends {
  range: TrendRange;
  windowStart: number;
  buckets: FocusBucket[];
  totalFocusMillis: number;
  completedSessions: number;
  blockedAttempts: number;
  topApps: AppAttempt[];
}

export interface ScreenTimeApp {
  packageName: string;
  appName: string;
  usageMillis: number;
}

export interface ScreenTimeReport {
  available: boolean;
  windowStart: number;
  totalMillis: number;
  apps: ScreenTimeApp[];
}

/** Monday is bit 0 through Sunday at bit 6, so a schedule stays one row. */
export interface FocusSchedule {
  id: string;
  label: string;
  days: number;
  startMinute: number;
  durationMinutes: number;
  strict: boolean;
  enabled: boolean;
}

/** Pro unlocks strict sessions. Bought once through Google Play; cached on the phone. */
export interface ProStatus {
  unlocked: boolean;
  /** Google Play answered on this phone and offers Pro, so it can be bought here. */
  available: boolean;
  /** Play's formatted price in the buyer's currency, or null until Play answers. */
  price: string | null;
  /** Paid with a method that settles later; unlocks once Play confirms it. */
  pending: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  license: string;
  source: string;
  pageCount: number;
  /** Where the reader left off, zero-based. */
  page: number;
}

export type BlockMaterial = 'book' | 'words' | 'timer';

export interface BookShelf {
  /** What the block screen shows. */
  material: BlockMaterial;
  /** English words: the deck's size, words seen, and words known several times over. */
  words: {deckSize: number; seen: number; learned: number};
  selected: string | null;
  pagesRead: number;
  books: Book[];
}

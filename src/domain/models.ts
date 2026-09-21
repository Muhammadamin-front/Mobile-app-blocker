export type ThemePreference = 'system' | 'light' | 'dark';
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
  completedReason?: string;
  blockedAttempts: number;
  /** Native monotonic snapshots used for clock-change-resistant UI countdowns. */
  remainingMillis?: number;
  startsInMillis?: number;
}

export interface PermissionStatus {
  accessibilityEnabled: boolean;
  /** Optional: powers the screen-time breakdown only, never blocking. */
  usageAccessEnabled: boolean;
  ready: boolean;
}

export interface AppSettings {
  onboardingCompleted: boolean;
  themePreference: ThemePreference;
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

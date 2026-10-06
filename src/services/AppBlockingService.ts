import {LanguagePreference} from '../i18n';
import {IconMap} from '../domain/icons';
import {
  AppSettings,
  FocusSession,
  BookShelf,
  FocusSchedule,
  FocusTrends,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  ScreenTimeReport,
  StartSessionInput,
  ThemePreference,
  TrendRange,
} from '../domain/models';

export interface AppBlockingService {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestRequiredPermissions(): Promise<void>;
  requestUsageAccess(): Promise<void>;
  openBatterySettings(): Promise<void>;
  /**
   * Asks for permission to show the session timer. Denial is not fatal: the session
   * runs either way, it simply has no notification.
   */
  ensureTimerNotificationPermission(): Promise<boolean>;
  getScreenTime(range: TrendRange): Promise<ScreenTimeReport>;
  startBlockingSession(input: StartSessionInput): Promise<FocusSession>;
  stopBlockingSession(): Promise<FocusSession | null>;
  getActiveSession(): Promise<FocusSession | null>;
  getBlockedApps(): Promise<InstalledApp[]>;
  getAppIcons(packages: string[]): Promise<IconMap>;
  setBlockedApps(apps: InstalledApp[]): Promise<void>;
  getHistory(): Promise<FocusSession[]>;
  getStatistics(): Promise<FocusStats>;
  getTrends(range: TrendRange): Promise<FocusTrends>;
  getSchedules(): Promise<FocusSchedule[]>;
  getBooks(): Promise<BookShelf>;
  selectBook(id: string | null): Promise<void>;
  saveSchedule(schedule: FocusSchedule): Promise<void>;
  deleteSchedule(id: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  completeOnboarding(): Promise<void>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  setLanguagePreference(language: LanguagePreference): Promise<void>;
  resetAllData(): Promise<void>;
}

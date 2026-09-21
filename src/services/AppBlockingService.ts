import {IconMap} from '../domain/icons';
import {
  AppSettings,
  FocusSession,
  FocusTrends,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  StartSessionInput,
  ThemePreference,
  TrendRange,
} from '../domain/models';

export interface AppBlockingService {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestRequiredPermissions(): Promise<void>;
  startBlockingSession(input: StartSessionInput): Promise<FocusSession>;
  stopBlockingSession(): Promise<FocusSession | null>;
  getActiveSession(): Promise<FocusSession | null>;
  getBlockedApps(): Promise<InstalledApp[]>;
  getAppIcons(packages: string[]): Promise<IconMap>;
  setBlockedApps(apps: InstalledApp[]): Promise<void>;
  getHistory(): Promise<FocusSession[]>;
  getStatistics(): Promise<FocusStats>;
  getTrends(range: TrendRange): Promise<FocusTrends>;
  getSettings(): Promise<AppSettings>;
  completeOnboarding(): Promise<void>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  resetAllData(): Promise<void>;
}

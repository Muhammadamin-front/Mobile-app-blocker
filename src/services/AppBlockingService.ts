import {
  AppSettings,
  FocusSession,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  StartSessionInput,
  ThemePreference,
} from '../domain/models';

export interface AppBlockingService {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestRequiredPermissions(): Promise<void>;
  startBlockingSession(input: StartSessionInput): Promise<FocusSession>;
  stopBlockingSession(): Promise<FocusSession | null>;
  getActiveSession(): Promise<FocusSession | null>;
  getBlockedApps(): Promise<InstalledApp[]>;
  setBlockedApps(apps: InstalledApp[]): Promise<void>;
  getHistory(): Promise<FocusSession[]>;
  getStatistics(): Promise<FocusStats>;
  getSettings(): Promise<AppSettings>;
  completeOnboarding(): Promise<void>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  resetAllData(): Promise<void>;
}

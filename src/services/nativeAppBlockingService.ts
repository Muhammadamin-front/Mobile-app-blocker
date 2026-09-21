import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

import {LanguagePreference} from '../i18n';
import {IconMap, withoutIcons} from '../domain/icons';

import {
  AppSettings,
  FocusSession,
  FocusTrends,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  ScreenTimeReport,
  StartSessionInput,
  ThemePreference,
  TrendRange,
} from '../domain/models';
import {AppBlockingService} from './AppBlockingService';

interface NativeFocusGuardModule {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  openAccessibilitySettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
  getScreenTime(range: TrendRange): Promise<ScreenTimeReport>;
  startBlockingSession(input: StartSessionInput): Promise<FocusSession>;
  stopBlockingSession(): Promise<FocusSession | null>;
  getActiveSession(): Promise<FocusSession | null>;
  getSelectedApps(): Promise<InstalledApp[]>;
  getAppIcons(packages: string[]): Promise<IconMap>;
  setSelectedApps(apps: InstalledApp[]): Promise<void>;
  getHistory(): Promise<FocusSession[]>;
  getStatistics(): Promise<FocusStats>;
  getTrends(range: TrendRange): Promise<FocusTrends>;
  getSettings(): Promise<AppSettings>;
  completeOnboarding(): Promise<void>;
  setThemePreference(theme: ThemePreference): Promise<void>;
  setLanguagePreference(language: LanguagePreference): Promise<void>;
  resetAllData(): Promise<void>;
}

function getNativeModule(): NativeFocusGuardModule {
  const module = NativeModules.FocusGuard;
  if (!module) {
    throw new Error(
      Platform.OS === 'android'
        ? 'FocusGuard Android module is unavailable.'
        : 'App blocking is not implemented on this platform yet.',
    );
  }
  return module;
}

async function ensureTimerNotificationPermission(): Promise<boolean> {
  // The permission only exists from Android 13; before that the timer just shows.
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  try {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) {
      return true;
    }
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export const appBlockingService: AppBlockingService = {
  getInstalledApps: () => getNativeModule().getInstalledApps(),
  getPermissionStatus: () => getNativeModule().getPermissionStatus(),
  requestRequiredPermissions: () =>
    getNativeModule().openAccessibilitySettings(),
  requestUsageAccess: () => getNativeModule().openUsageAccessSettings(),
  ensureTimerNotificationPermission,
  getScreenTime: range => getNativeModule().getScreenTime(range),
  startBlockingSession: input =>
    getNativeModule().startBlockingSession({
      ...input,
      blockedApps: withoutIcons(input.blockedApps),
    }),
  stopBlockingSession: () => getNativeModule().stopBlockingSession(),
  getActiveSession: () => getNativeModule().getActiveSession(),
  getBlockedApps: () => getNativeModule().getSelectedApps(),
  getAppIcons: packages => getNativeModule().getAppIcons(packages),
  setBlockedApps: apps => getNativeModule().setSelectedApps(withoutIcons(apps)),
  getHistory: () => getNativeModule().getHistory(),
  getStatistics: () => getNativeModule().getStatistics(),
  getTrends: range => getNativeModule().getTrends(range),
  getSettings: () => getNativeModule().getSettings(),
  completeOnboarding: () => getNativeModule().completeOnboarding(),
  setThemePreference: theme =>
    getNativeModule().setThemePreference(theme),
  setLanguagePreference: language =>
    getNativeModule().setLanguagePreference(language),
  resetAllData: () => getNativeModule().resetAllData(),
};

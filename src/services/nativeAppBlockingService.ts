import {NativeModules, Platform} from 'react-native';

import {IconMap, withoutIcons} from '../domain/icons';

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
import {AppBlockingService} from './AppBlockingService';

interface NativeFocusGuardModule {
  getInstalledApps(): Promise<InstalledApp[]>;
  getPermissionStatus(): Promise<PermissionStatus>;
  openAccessibilitySettings(): Promise<void>;
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

export const appBlockingService: AppBlockingService = {
  getInstalledApps: () => getNativeModule().getInstalledApps(),
  getPermissionStatus: () => getNativeModule().getPermissionStatus(),
  requestRequiredPermissions: () =>
    getNativeModule().openAccessibilitySettings(),
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
  resetAllData: () => getNativeModule().resetAllData(),
};

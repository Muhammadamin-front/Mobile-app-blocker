import {NativeModules, Platform} from 'react-native';

import {
  AppSettings,
  FocusSession,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  StartSessionInput,
  ThemePreference,
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
  setSelectedApps(apps: InstalledApp[]): Promise<void>;
  getHistory(): Promise<FocusSession[]>;
  getStatistics(): Promise<FocusStats>;
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
    getNativeModule().startBlockingSession(input),
  stopBlockingSession: () => getNativeModule().stopBlockingSession(),
  getActiveSession: () => getNativeModule().getActiveSession(),
  getBlockedApps: () => getNativeModule().getSelectedApps(),
  setBlockedApps: apps => getNativeModule().setSelectedApps(apps),
  getHistory: () => getNativeModule().getHistory(),
  getStatistics: () => getNativeModule().getStatistics(),
  getSettings: () => getNativeModule().getSettings(),
  completeOnboarding: () => getNativeModule().completeOnboarding(),
  setThemePreference: theme =>
    getNativeModule().setThemePreference(theme),
  resetAllData: () => getNativeModule().resetAllData(),
};

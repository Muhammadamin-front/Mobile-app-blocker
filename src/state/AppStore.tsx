import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {AppState} from 'react-native';

import {
  AppSettings,
  FocusSession,
  FocusStats,
  InstalledApp,
  PermissionStatus,
  StartSessionInput,
  ThemePreference,
} from '../domain/models';
import {appBlockingService} from '../services/nativeAppBlockingService';

const emptyStats: FocusStats = {
  completedSessions: 0,
  totalFocusMillis: 0,
  totalBlockedAttempts: 0,
  attemptsByPackage: [],
};

interface AppStoreValue {
  loading: boolean;
  busy: boolean;
  error: string | null;
  installedApps: InstalledApp[];
  selectedApps: InstalledApp[];
  activeSession: FocusSession | null;
  history: FocusSession[];
  stats: FocusStats;
  permission: PermissionStatus;
  onboardingCompleted: boolean;
  themePreference: ThemePreference;
  refresh(): Promise<void>;
  loadInstalledApps(): Promise<void>;
  setSelectedApps(apps: InstalledApp[]): Promise<void>;
  startSession(input: StartSessionInput): Promise<void>;
  stopSession(): Promise<void>;
  openPermissionSettings(): Promise<void>;
  completeOnboarding(): Promise<void>;
  setTheme(theme: ThemePreference): Promise<void>;
  resetAllData(): Promise<void>;
  clearError(): void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({children}: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [selectedApps, setSelectedAppsState] = useState<InstalledApp[]>([]);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusStats>(emptyStats);
  const [permission, setPermission] = useState<PermissionStatus>({
    accessibilityEnabled: false,
    ready: false,
  });
  const [settings, setSettings] = useState<AppSettings>({
    onboardingCompleted: false,
    themePreference: 'system',
  });

  const run = useCallback(async (operation: () => Promise<void>) => {
    try {
      setError(null);
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    }
  }, []);

  const refresh = useCallback(async () => {
    await run(async () => {
      const [nextPermission, session, nextHistory, nextStats, nextSettings, apps] =
        await Promise.all([
          appBlockingService.getPermissionStatus(),
          appBlockingService.getActiveSession(),
          appBlockingService.getHistory(),
          appBlockingService.getStatistics(),
          appBlockingService.getSettings(),
          appBlockingService.getBlockedApps(),
        ]);
      setPermission(nextPermission);
      setActiveSession(session);
      setHistory(nextHistory);
      setStats(nextStats);
      setSettings(nextSettings);
      setSelectedAppsState(apps);
    });
  }, [run]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const loadInstalledApps = useCallback(async () => {
    if (installedApps.length) {
      return;
    }
    setBusy(true);
    await run(async () => setInstalledApps(await appBlockingService.getInstalledApps()));
    setBusy(false);
  }, [installedApps.length, run]);

  const updateSelectedApps = useCallback(
    async (apps: InstalledApp[]) => {
      const previous = selectedApps;
      setSelectedAppsState(apps);
      await run(async () => {
        try {
          await appBlockingService.setBlockedApps(apps);
        } catch (caught) {
          setSelectedAppsState(previous);
          throw caught;
        }
      });
    },
    [run, selectedApps],
  );

  const startSession = useCallback(
    async (input: StartSessionInput) => {
      if (busy) {
        return;
      }
      setBusy(true);
      await run(async () => {
        const session = await appBlockingService.startBlockingSession(input);
        setActiveSession(session);
        await refresh();
      });
      setBusy(false);
    },
    [busy, refresh, run],
  );

  const stopSession = useCallback(async () => {
    setBusy(true);
    await run(async () => {
      await appBlockingService.stopBlockingSession();
      await refresh();
    });
    setBusy(false);
  }, [refresh, run]);

  const openPermissionSettings = useCallback(async () => {
    await run(() => appBlockingService.requestRequiredPermissions());
  }, [run]);

  const completeOnboarding = useCallback(async () => {
    await run(async () => {
      await appBlockingService.completeOnboarding();
      setSettings(current => ({...current, onboardingCompleted: true}));
    });
  }, [run]);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      setSettings(current => ({...current, themePreference: theme}));
      await run(() => appBlockingService.setThemePreference(theme));
    },
    [run],
  );

  const resetAllData = useCallback(async () => {
    setBusy(true);
    await run(async () => {
      await appBlockingService.resetAllData();
      setSelectedAppsState([]);
      setActiveSession(null);
      setHistory([]);
      setStats(emptyStats);
      setSettings({onboardingCompleted: false, themePreference: 'system'});
    });
    setBusy(false);
  }, [run]);

  const value = useMemo<AppStoreValue>(
    () => ({
      loading,
      busy,
      error,
      installedApps,
      selectedApps,
      activeSession,
      history,
      stats,
      permission,
      onboardingCompleted: settings.onboardingCompleted,
      themePreference: settings.themePreference,
      refresh,
      loadInstalledApps,
      setSelectedApps: updateSelectedApps,
      startSession,
      stopSession,
      openPermissionSettings,
      completeOnboarding,
      setTheme,
      resetAllData,
      clearError: () => setError(null),
    }),
    [
      activeSession,
      busy,
      completeOnboarding,
      error,
      history,
      installedApps,
      loadInstalledApps,
      loading,
      openPermissionSettings,
      permission,
      refresh,
      resetAllData,
      selectedApps,
      settings,
      startSession,
      stats,
      stopSession,
      updateSelectedApps,
      setTheme,
    ],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) {
    throw new Error('useAppStore must be used inside AppStoreProvider.');
  }
  return value;
}

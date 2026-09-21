import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {AppState} from 'react-native';

import {IconMap, missingIconPackages, withIcons} from '../domain/icons';
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
import {appBlockingService} from '../services/nativeAppBlockingService';

const emptyStats: FocusStats = {
  completedSessions: 0,
  totalFocusMillis: 0,
  totalBlockedAttempts: 0,
  attemptsByPackage: [],
};

const emptyTrends: FocusTrends = {
  range: 'week',
  windowStart: 0,
  buckets: [],
  totalFocusMillis: 0,
  completedSessions: 0,
  blockedAttempts: 0,
  topApps: [],
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
  trends: FocusTrends;
  trendRange: TrendRange;
  trendsLoading: boolean;
  permission: PermissionStatus;
  onboardingCompleted: boolean;
  themePreference: ThemePreference;
  refresh(): Promise<void>;
  setTrendRange(range: TrendRange): void;
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
  const [trends, setTrends] = useState<FocusTrends>(emptyTrends);
  const [trendRange, setTrendRange] = useState<TrendRange>('week');
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionStatus>({
    accessibilityEnabled: false,
    ready: false,
  });
  const [settings, setSettings] = useState<AppSettings>({
    onboardingCompleted: false,
    themePreference: 'system',
  });
  // Icons live outside the database, so they are resolved per package and cached
  // here. Packages we already asked about are remembered even when the platform
  // returned nothing, so a missing icon cannot become a request loop.
  const [icons, setIcons] = useState<IconMap>({});
  const requestedIcons = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

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

  // A session is only worth showing as enforced while the service is really on.
  // Force-stopping the app makes Android disable it, and nothing else tells us.
  useEffect(() => {
    if (!activeSession) {
      return;
    }
    const timer = setInterval(() => {
      appBlockingService
        .getPermissionStatus()
        .then(setPermission)
        .catch(() => undefined);
    }, 8_000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const iconTargets = useMemo(
    () => [...selectedApps, ...(activeSession?.blockedApps ?? [])],
    [activeSession, selectedApps],
  );

  useEffect(() => {
    const missing = missingIconPackages(iconTargets, icons).filter(
      packageName => !requestedIcons.current.has(packageName),
    );
    if (!missing.length) {
      return;
    }
    // The result is kept even if this effect re-runs first: the packages are
    // already marked as requested, so discarding it would lose them for good.
    missing.forEach(packageName => requestedIcons.current.add(packageName));
    appBlockingService
      .getAppIcons(missing)
      .then(loaded => {
        if (mounted.current) {
          setIcons(current => ({...current, ...loaded}));
        }
      })
      .catch(() => undefined);
  }, [iconTargets, icons]);

  // Trends are re-read on every range change and whenever a session ends, so the
  // chart never shows a window the sessions list has already moved past.
  useEffect(() => {
    let cancelled = false;
    setTrendsLoading(true);
    appBlockingService
      .getTrends(trendRange)
      .then(next => {
        if (!cancelled) {
          setTrends(next);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setTrendsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [history, stats, trendRange]);

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
      setIcons({});
      requestedIcons.current.clear();
      setHistory([]);
      setStats(emptyStats);
      setTrends(emptyTrends);
      setSettings({onboardingCompleted: false, themePreference: 'system'});
    });
    setBusy(false);
  }, [run]);

  const decoratedSelectedApps = useMemo(
    () => withIcons(selectedApps, icons),
    [icons, selectedApps],
  );

  const decoratedSession = useMemo(
    () =>
      activeSession
        ? {...activeSession, blockedApps: withIcons(activeSession.blockedApps, icons)}
        : null,
    [activeSession, icons],
  );

  const value = useMemo<AppStoreValue>(
    () => ({
      loading,
      busy,
      error,
      installedApps,
      selectedApps: decoratedSelectedApps,
      activeSession: decoratedSession,
      history,
      stats,
      trends,
      trendRange,
      trendsLoading,
      setTrendRange,
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
      busy,
      completeOnboarding,
      decoratedSelectedApps,
      decoratedSession,
      error,
      history,
      installedApps,
      loadInstalledApps,
      loading,
      openPermissionSettings,
      permission,
      refresh,
      resetAllData,
      settings,
      startSession,
      stats,
      stopSession,
      trendRange,
      trends,
      trendsLoading,
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

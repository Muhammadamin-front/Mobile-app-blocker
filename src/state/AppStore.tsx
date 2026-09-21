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
  createTranslator,
  LanguagePreference,
  resolveLanguage,
  Translate,
} from '../i18n';
import {
  AppSettings,
  FocusSession,
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
import {appBlockingService} from '../services/nativeAppBlockingService';

const emptyStats: FocusStats = {
  completedSessions: 0,
  totalFocusMillis: 0,
  totalBlockedAttempts: 0,
  attemptsByPackage: [],
};

const emptyScreenTime: ScreenTimeReport = {
  available: false,
  windowStart: 0,
  totalMillis: 0,
  apps: [],
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
  schedules: FocusSchedule[];
  screenTime: ScreenTimeReport;
  trendRange: TrendRange;
  trendsLoading: boolean;
  permission: PermissionStatus;
  onboardingCompleted: boolean;
  themePreference: ThemePreference;
  language: LanguagePreference;
  t: Translate;
  setLanguage(language: LanguagePreference): Promise<void>;
  refresh(): Promise<void>;
  setTrendRange(range: TrendRange): void;
  saveSchedule(schedule: FocusSchedule): Promise<void>;
  deleteSchedule(id: string): Promise<void>;
  loadInstalledApps(): Promise<void>;
  setSelectedApps(apps: InstalledApp[]): Promise<void>;
  startSession(input: StartSessionInput): Promise<void>;
  stopSession(): Promise<void>;
  openPermissionSettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
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
  const [screenTime, setScreenTime] = useState<ScreenTimeReport>(emptyScreenTime);
  const [schedules, setSchedules] = useState<FocusSchedule[]>([]);
  const [trendRange, setTrendRange] = useState<TrendRange>('week');
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [permission, setPermission] = useState<PermissionStatus>({
    accessibilityEnabled: false,
    usageAccessEnabled: false,
    ready: false,
  });
  const [settings, setSettings] = useState<AppSettings>({
    onboardingCompleted: false,
    themePreference: 'system',
    language: 'system',
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
      const [
        nextPermission,
        session,
        nextHistory,
        nextStats,
        nextSettings,
        apps,
        nextSchedules,
      ] = await Promise.all([
          appBlockingService.getPermissionStatus(),
          appBlockingService.getActiveSession(),
          appBlockingService.getHistory(),
          appBlockingService.getStatistics(),
          appBlockingService.getSettings(),
          appBlockingService.getBlockedApps(),
          appBlockingService.getSchedules(),
        ]);
      setPermission(nextPermission);
      setActiveSession(session);
      setHistory(nextHistory);
      setStats(nextStats);
      setSettings(nextSettings);
      setSelectedAppsState(apps);
      setSchedules(nextSchedules);
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

  // Screen time is optional data behind an optional permission: when it is off we
  // ask for nothing and show nothing rather than holding an empty section open.
  useEffect(() => {
    if (!permission.usageAccessEnabled) {
      setScreenTime(emptyScreenTime);
      return;
    }
    let cancelled = false;
    appBlockingService
      .getScreenTime(trendRange)
      .then(next => {
        if (!cancelled) {
          setScreenTime(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [permission.usageAccessEnabled, trendRange, history]);

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
        // Asked for here rather than at onboarding, so the request arrives with the
        // reason visible on screen. A refusal must not stop the session.
        await appBlockingService.ensureTimerNotificationPermission().catch(() => false);
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

  const openUsageAccessSettings = useCallback(async () => {
    await run(() => appBlockingService.requestUsageAccess());
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

  const saveSchedule = useCallback(
    async (schedule: FocusSchedule) => {
      await run(async () => {
        await appBlockingService.saveSchedule(schedule);
        setSchedules(await appBlockingService.getSchedules());
      });
    },
    [run],
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      await run(async () => {
        await appBlockingService.deleteSchedule(id);
        setSchedules(await appBlockingService.getSchedules());
      });
    },
    [run],
  );

  const setLanguage = useCallback(
    async (language: LanguagePreference) => {
      setSettings(current => ({...current, language}));
      await run(() => appBlockingService.setLanguagePreference(language));
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
      setScreenTime(emptyScreenTime);
      setSchedules([]);
      setSettings({onboardingCompleted: false, themePreference: 'system', language: 'system'});
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

  // Recreated only when the resolved language changes, so every screen reading `t`
  // re-renders exactly once on a language switch.
  const translate = useMemo(
    () => createTranslator(resolveLanguage(settings.language, settings.deviceLanguage)),
    [settings.deviceLanguage, settings.language],
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
      schedules,
      screenTime,
      trendRange,
      trendsLoading,
      setTrendRange,
      saveSchedule,
      deleteSchedule,
      permission,
      onboardingCompleted: settings.onboardingCompleted,
      themePreference: settings.themePreference,
      language: settings.language,
      t: translate,
      setLanguage,
      refresh,
      loadInstalledApps,
      setSelectedApps: updateSelectedApps,
      startSession,
      stopSession,
      openPermissionSettings,
      openUsageAccessSettings,
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
      openUsageAccessSettings,
      permission,
      refresh,
      deleteSchedule,
      resetAllData,
      saveSchedule,
      schedules,
      screenTime,
      setLanguage,
      settings,
      translate,
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

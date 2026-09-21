import {InstalledApp} from './models';

/** Base64 PNG icons keyed by package name. Loaded on demand and never persisted. */
export type IconMap = Record<string, string>;

export function withIcons<T extends InstalledApp>(apps: T[], icons: IconMap): T[] {
  return apps.map(app =>
    app.iconBase64 || !icons[app.packageName]
      ? app
      : {...app, iconBase64: icons[app.packageName]},
  );
}

export function missingIconPackages(
  apps: InstalledApp[],
  icons: IconMap,
): string[] {
  return Array.from(
    new Set(
      apps
        .filter(app => !app.iconBase64 && !icons[app.packageName])
        .map(app => app.packageName),
    ),
  );
}

/** Strips icons before anything crosses the bridge or reaches native storage. */
export function withoutIcons(apps: InstalledApp[]): InstalledApp[] {
  return apps.map(({packageName, appName}) => ({packageName, appName}));
}

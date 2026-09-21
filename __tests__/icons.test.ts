import {
  missingIconPackages,
  withIcons,
  withoutIcons,
} from '../src/domain/icons';
import {formatFocusTotal, formatSpanHm, pluralize} from '../src/domain/session';

const apps = [
  {packageName: 'com.example.social', appName: 'Social'},
  {packageName: 'com.example.video', appName: 'Video', iconBase64: 'embedded'},
];

describe('app icons', () => {
  it('fills in only the icons that are missing', () => {
    const merged = withIcons(apps, {'com.example.social': 'fetched'});
    expect(merged[0].iconBase64).toBe('fetched');
    expect(merged[1].iconBase64).toBe('embedded');
  });

  it('leaves an app untouched when no icon is known for it', () => {
    expect(withIcons(apps, {})[0].iconBase64).toBeUndefined();
  });

  it('asks only for packages that have neither an embedded nor a cached icon', () => {
    expect(missingIconPackages(apps, {})).toEqual(['com.example.social']);
    expect(missingIconPackages(apps, {'com.example.social': 'fetched'})).toEqual([]);
  });

  it('deduplicates repeated packages so one request covers them', () => {
    expect(missingIconPackages([apps[0], apps[0]], {})).toEqual([
      'com.example.social',
    ]);
  });

  it('strips icons before they reach the bridge or native storage', () => {
    expect(withoutIcons(apps)).toEqual([
      {packageName: 'com.example.social', appName: 'Social'},
      {packageName: 'com.example.video', appName: 'Video'},
    ]);
  });
});

describe('statistics formatting', () => {
  it('keeps short totals readable instead of rounding them to zero hours', () => {
    expect(formatFocusTotal(60_000)).toBe('1m');
    expect(formatFocusTotal(45 * 60_000)).toBe('45m');
    expect(formatFocusTotal(90 * 60_000)).toBe('1.5h');
    expect(formatFocusTotal(12 * 3_600_000)).toBe('12h');
    expect(formatFocusTotal(-5)).toBe('0m');
  });

  it('never rounds a real span down to nothing', () => {
    expect(formatSpanHm(0)).toBe('0m');
    expect(formatSpanHm(30_000)).toBe('<1m');
    expect(formatSpanHm(59_999)).toBe('<1m');
    expect(formatSpanHm(60_000)).toBe('1m');
    expect(formatSpanHm(95 * 60_000)).toBe('1h 35m');
  });

  it('agrees with itself about singular and plural counts', () => {
    expect(pluralize(1, 'app')).toBe('1 app');
    expect(pluralize(0, 'app')).toBe('0 apps');
    expect(pluralize(3, 'app')).toBe('3 apps');
  });
});

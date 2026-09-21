import {FocusSchedule} from './models';

export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const EVERY_DAY = 0b1111111;
export const WEEKDAYS = 0b0011111;
export const WEEKEND = 0b1100000;

export function hasDay(days: number, index: number): boolean {
  return ((days >> index) & 1) === 1;
}

export function toggleDay(days: number, index: number): number {
  return days ^ (1 << index);
}

/** "Every day", "Weekdays", or the short day names, whichever reads shortest. */
export function describeDays(
  days: number,
  translate: (english: string) => string,
): string {
  const masked = days & EVERY_DAY;
  if (masked === EVERY_DAY) {
    return translate('Every day');
  }
  if (masked === WEEKDAYS) {
    return translate('Weekdays');
  }
  if (masked === WEEKEND) {
    return translate('Weekend');
  }
  const names = DAY_KEYS.filter((_, index) => hasDay(masked, index)).map(day =>
    translate(day),
  );
  return names.length ? names.join(' · ') : translate('No days');
}

export function formatStartMinute(startMinute: number): string {
  const hours = Math.floor(startMinute / 60) % 24;
  const minutes = startMinute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function createSchedule(): FocusSchedule {
  return {
    id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    days: WEEKDAYS,
    startMinute: 9 * 60,
    durationMinutes: 60,
    strict: false,
    enabled: true,
  };
}

export function shiftMinute(startMinute: number, deltaMinutes: number): number {
  const total = startMinute + deltaMinutes;
  return ((total % 1440) + 1440) % 1440;
}

import {FocusSession, SessionStatus} from './models';

export const DURATION_PRESETS = [15, 30, 60, 120] as const;

export function createSessionId(now = Date.now()): string {
  return `focus-${now}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveSessionStatus(
  session: FocusSession,
  now = Date.now(),
): SessionStatus {
  if (session.status === 'STOPPED' || session.status === 'COMPLETED') {
    return session.status;
  }
  if (now < session.startTimestamp) {
    return 'SCHEDULED';
  }
  return now < session.endTimestamp ? 'ACTIVE' : 'COMPLETED';
}

export function getSessionRemainingMillis(
  session: FocusSession | null,
  now = Date.now(),
): number {
  if (!session || deriveSessionStatus(session, now) === 'COMPLETED') {
    return 0;
  }
  return Math.max(0, session.endTimestamp - Math.max(now, session.startTimestamp));
}

export function formatDuration(totalMillis: number): string {
  const totalSeconds = Math.max(0, Math.ceil(totalMillis / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours} hr`;
}

/** Compact total for the statistics tiles: minutes below an hour, one decimal above. */
export function formatFocusTotal(totalMillis: number): string {
  const minutes = Math.max(0, Math.round(totalMillis / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
}

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** Hours and minutes, the way a person says a duration out loud. */
export function formatFocusHm(totalMillis: number): string {
  const minutes = Math.max(0, Math.round(totalMillis / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

/** Like formatFocusHm, but a real span shorter than a minute never reads as nothing. */
export function formatSpanHm(totalMillis: number): string {
  if (totalMillis > 0 && totalMillis < 60_000) {
    return '<1m';
  }
  return formatFocusHm(totalMillis);
}

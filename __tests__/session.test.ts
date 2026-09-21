import {
  deriveSessionStatus,
  formatDuration,
  getSessionRemainingMillis,
} from '../src/domain/session';
import {FocusSession} from '../src/domain/models';

const baseSession: FocusSession = {
  id: 'focus-test',
  startTimestamp: 1_000,
  endTimestamp: 61_000,
  blockedApps: [{packageName: 'com.example.social', appName: 'Social'}],
  status: 'SCHEDULED',
  blockedAttempts: 0,
};

describe('focus session timing', () => {
  it('moves a scheduled session through active and completed states', () => {
    expect(deriveSessionStatus(baseSession, 500)).toBe('SCHEDULED');
    expect(deriveSessionStatus(baseSession, 1_000)).toBe('ACTIVE');
    expect(deriveSessionStatus(baseSession, 60_999)).toBe('ACTIVE');
    expect(deriveSessionStatus(baseSession, 61_000)).toBe('COMPLETED');
  });

  it('never overrides an explicitly stopped session', () => {
    expect(
      deriveSessionStatus({...baseSession, status: 'STOPPED'}, 2_000),
    ).toBe('STOPPED');
  });

  it('clamps remaining time and formats it predictably', () => {
    expect(getSessionRemainingMillis(baseSession, 31_000)).toBe(30_000);
    expect(getSessionRemainingMillis(baseSession, 70_000)).toBe(0);
    expect(formatDuration(3_661_001)).toBe('01:01:02');
    expect(formatDuration(-1)).toBe('00:00:00');
  });
});

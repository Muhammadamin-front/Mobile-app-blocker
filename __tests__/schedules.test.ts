import {
  describeDays,
  EVERY_DAY,
  formatStartMinute,
  hasDay,
  shiftMinute,
  toggleDay,
  WEEKDAYS,
  WEEKEND,
} from '../src/domain/schedules';

const en = (value: string) => value;

describe('schedule days', () => {
  it('reads a day out of the mask', () => {
    expect(hasDay(WEEKDAYS, 0)).toBe(true);
    expect(hasDay(WEEKDAYS, 6)).toBe(false);
    expect(hasDay(WEEKEND, 5)).toBe(true);
  });

  it('toggles a day without touching the others', () => {
    const withoutMonday = toggleDay(WEEKDAYS, 0);
    expect(hasDay(withoutMonday, 0)).toBe(false);
    expect(hasDay(withoutMonday, 1)).toBe(true);
    expect(toggleDay(withoutMonday, 0)).toBe(WEEKDAYS);
  });

  it('names the common patterns instead of listing seven days', () => {
    expect(describeDays(EVERY_DAY, en)).toBe('Every day');
    expect(describeDays(WEEKDAYS, en)).toBe('Weekdays');
    expect(describeDays(WEEKEND, en)).toBe('Weekend');
  });

  it('lists the days when the pattern has no name', () => {
    expect(describeDays(0b0000101, en)).toBe('Mon · Wed');
  });

  it('says so when a schedule has no days at all', () => {
    expect(describeDays(0, en)).toBe('No days');
  });
});

describe('schedule time', () => {
  it('formats a start minute as a clock time', () => {
    expect(formatStartMinute(0)).toBe('00:00');
    expect(formatStartMinute(9 * 60)).toBe('09:00');
    expect(formatStartMinute(13 * 60 + 5)).toBe('13:05');
    expect(formatStartMinute(23 * 60 + 59)).toBe('23:59');
  });

  it('wraps around midnight in both directions', () => {
    expect(shiftMinute(23 * 60 + 45, 30)).toBe(15);
    expect(shiftMinute(10, -30)).toBe(1420);
    expect(shiftMinute(0, -1)).toBe(1439);
  });
});

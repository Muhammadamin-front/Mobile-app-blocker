import {daysUntil, examName} from '../src/domain/exam';
import {createTranslator} from '../src/i18n';

describe('exam countdown', () => {
  const evening = new Date(2026, 9, 10, 23, 30);

  it('counts calendar days, not 24-hour spans', () => {
    expect(daysUntil('2026-10-11', evening)).toBe(1);
    expect(daysUntil('2026-10-10', evening)).toBe(0);
  });

  it('goes negative once the exam has passed', () => {
    expect(daysUntil('2026-10-01', evening)).toBe(-9);
  });

  it('counts across a month and a year', () => {
    expect(daysUntil('2027-01-01', evening)).toBe(83);
  });

  it('refuses a malformed date instead of guessing', () => {
    expect(daysUntil('10/11/2026', evening)).toBeNull();
  });

  it('names a custom exam by its own label', () => {
    const t = createTranslator('en');
    expect(examName({kind: 'custom', label: 'Olympiad', date: '2027-01-01'}, t)).toBe('Olympiad');
    expect(examName({kind: 'dtm', label: '', date: '2027-01-01'}, t)).toBe('DTM');
  });
});

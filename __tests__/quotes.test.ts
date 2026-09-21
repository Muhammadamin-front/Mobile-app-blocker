import {FOCUS_QUOTES, pickQuote} from '../src/domain/quotes';

describe('intro quotes', () => {
  it('returns the same quote for the same launch seed', () => {
    expect(pickQuote(7)).toBe(pickQuote(7));
  });

  it('walks the whole set rather than favouring one entry', () => {
    const seen = new Set(
      Array.from({length: FOCUS_QUOTES.length}, (_, index) => pickQuote(index).text),
    );
    expect(seen.size).toBe(FOCUS_QUOTES.length);
  });

  it('survives a seed the platform could not produce', () => {
    expect(pickQuote(Number.NaN)).toBe(FOCUS_QUOTES[0]);
    expect(pickQuote(-3)).toBe(FOCUS_QUOTES[3 % FOCUS_QUOTES.length]);
  });

  it('ships quotes that fit the intro card', () => {
    FOCUS_QUOTES.forEach(quote => {
      expect(quote.text.length).toBeLessThanOrEqual(110);
      expect(quote.author.trim()).not.toBe('');
    });
  });

  it('refuses an empty set instead of returning undefined', () => {
    expect(() => pickQuote(1, [])).toThrow('At least one quote is required.');
  });
});

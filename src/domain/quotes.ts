export interface FocusQuote {
  text: string;
  author: string;
}

/**
 * Shown on the intro screen. Kept short enough to read in the two seconds the
 * screen is on, and attributed only where the attribution is well documented.
 */
export const FOCUS_QUOTES: FocusQuote[] = [
  {text: 'Concentration is the secret of strength.', author: 'Ralph Waldo Emerson'},
  {
    text: 'It is not enough to be busy. The question is: what are we busy about?',
    author: 'Henry David Thoreau',
  },
  {
    text: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
  },
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Will Durant',
  },
  {
    text: 'How we spend our days is, of course, how we spend our lives.',
    author: 'Annie Dillard',
  },
  {text: 'To do two things at once is to do neither.', author: 'Publilius Syrus'},
  {
    text: 'Time is what we want most, but what we use worst.',
    author: 'William Penn',
  },
  {
    text: 'Nothing is less productive than to make more efficient what should not be done at all.',
    author: 'Peter Drucker',
  },
];

/**
 * Deterministic for a given seed so the same launch never swaps the quote
 * mid-animation, and so the choice is testable.
 */
export function pickQuote(
  seed: number = Date.now(),
  quotes: FocusQuote[] = FOCUS_QUOTES,
): FocusQuote {
  if (!quotes.length) {
    throw new Error('At least one quote is required.');
  }
  const safeSeed = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  return quotes[safeSeed % quotes.length];
}

import { parseDate } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { NO_TIME_BOUNDS } from '@lunisolar-picker/core';
import { describe, expect, it } from 'vitest';
import { dateBoundsOf, resolveDateTimeBounds, timeBoundsOn } from './date-time-bounds';

const calendars = [dangi];
const dateOf = (input: string) => {
  const parsed = parseDate(input, { calendars });
  if (!parsed.isOk) throw new Error(`Unexpected date: ${input}`);
  return parsed.value.value;
};

describe('date-time-boundaries', () => {
  it('keeps explicit times and covers the whole day for a date-only bound', () => {
    const explicit = resolveDateTimeBounds('2026-11-24T14:30', undefined, calendars);
    expect(explicit.min?.value).toBe('2026-11-24T14:30');
    const dates = resolveDateTimeBounds('2026-11-24', '2026-11-30', calendars);
    expect(dates.min?.value).toBe('2026-11-24T00:00');
    expect(dates.max?.value).toBe('2026-11-30T23:59');
  });

  it('ignores boundaries that cannot be parsed', () => {
    expect(resolveDateTimeBounds('abc', '2026-11-24T24:00', calendars)).toEqual({ min: null, max: null });
  });

  it('ignores non-string bounds from JavaScript consumers', () => {
    // @ts-expect-error: JavaScript에서 필드 타입을 거치지 않고 전달한 값을 확인함
    expect(resolveDateTimeBounds(null, 14, calendars)).toEqual({ min: null, max: null });
  });

  it('compares each date independently of the calendar it was entered in', () => {
    const bounds = resolveDateTimeBounds('2026-11-24T14:30[u-ca=dangi]', '2026-11-30', calendars);
    expect(dateBoundsOf(bounds)).toEqual({ min: '2026-11-24', max: '2026-11-30' });
    expect(timeBoundsOn(dateOf('2026-11-24'), bounds)).toEqual({ min: '14:30', max: null });
    expect(timeBoundsOn(dateOf('2026-11-30[u-ca=dangi]'), bounds)).toEqual({ min: null, max: '23:59' });
    expect(timeBoundsOn(dateOf('2026-11-25'), bounds)).toEqual(NO_TIME_BOUNDS);
    expect(timeBoundsOn(null, bounds)).toEqual(NO_TIME_BOUNDS);
  });

  it('retains both time bounds when the minimum and maximum share a date', () => {
    const bounds = resolveDateTimeBounds('2026-11-24T14:30', '2026-11-24T15:45', calendars);
    expect(timeBoundsOn(dateOf('2026-11-24'), bounds)).toEqual({ min: '14:30', max: '15:45' });
  });
});

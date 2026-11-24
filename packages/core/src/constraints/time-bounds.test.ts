import { formatTime, parseTime } from '@lunisolar-picker/calendar';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NO_TIME_BOUNDS, resolveTimeBounds, timeBoundsReason } from './time-bounds';

describe('time bounds', () => {
  describe('resolveTimeBounds', () => {
    it('parses two bounds and accepts 24:00 as a boundary', () => {
      expect(resolveTimeBounds('09:00', '18:00')).toEqual({ min: '09:00', max: '18:00' });
      expect(resolveTimeBounds('24:00', '24:00')).toEqual({ min: '24:00', max: '24:00' });
    });

    it('ignores unreadable and unset bounds independently', () => {
      expect(resolveTimeBounds('25:00', undefined)).toEqual(NO_TIME_BOUNDS);
      expect(resolveTimeBounds(null, 'abc')).toEqual(NO_TIME_BOUNDS);
      expect(resolveTimeBounds('09:00', 'abc')).toEqual({ min: '09:00', max: null });
    });
  });

  describe('timeBoundsReason', () => {
    it.each([
      ['08:59', 'before-min'],
      ['09:00', null],
      ['18:00', null],
      ['18:01', 'after-max'],
    ])('applies inclusive boundaries to %s', (input, reason) => {
      const time = parseTime(input);
      if (!time.isOk) throw new Error('Expected a valid time fixture');
      expect(timeBoundsReason(time.value.value, resolveTimeBounds('09:00', '18:00'))).toBe(reason);
    });

    it('accepts any time with no bounds', () => {
      const time = parseTime('12:00');
      if (!time.isOk) throw new Error('Expected a valid time fixture');
      expect(timeBoundsReason(time.value.value, NO_TIME_BOUNDS)).toBeNull();
    });

    it('rejects all times for reversed bounds', () => {
      const bounds = resolveTimeBounds('15:00', '10:00');
      const beforeMin = parseTime('12:00');
      const afterMax = parseTime('16:00');
      if (!beforeMin.isOk || !afterMax.isOk) throw new Error('Expected valid time fixtures');
      expect(timeBoundsReason(beforeMin.value.value, bounds)).toBe('before-min');
      expect(timeBoundsReason(afterMax.value.value, bounds)).toBe('after-max');
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (hour, minute) => {
          const time = formatTime(hour, minute);
          if (!time.isOk) throw new Error('Expected a valid generated time');
          expect(timeBoundsReason(time.value, bounds)).not.toBeNull();
        }),
      );
    });
  });
});

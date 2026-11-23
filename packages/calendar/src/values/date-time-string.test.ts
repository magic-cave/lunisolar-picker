import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { brandEpochDay, epochDayFromCivil } from '../epoch-day';
import { gregory } from '../gregorian';
import { createStubCalendar } from '../testing/stub-calendar';
import { unwrapOk } from '../testing/unwrap-result';
import { formatDate, parseDate } from './date-string';
import { datePartOf, formatDateTime, parseDateTime, timePartOf } from './date-time-string';
import { formatTime, parseTime } from './time-string';

const stubDangi = createStubCalendar({
  id: 'dangi',
  supportedRange: { min: epochDayFromCivil(1900, 1, 31), max: epochDayFromCivil(2050, 12, 31) },
  fields: { year: 2026, monthCode: 'M10', day: 16 },
});
const calendars = [stubDangi];
const gregorianDay = fc.integer(gregory.supportedRange);
const hour = fc.integer({ min: 0, max: 23 });
const minute = fc.integer({ min: 0, max: 59 });

describe('date-time-string', () => {
  describe('parseDateTime', () => {
    it.each(['00:00', '14:30', '23:59'])('reads the minute-precision time %s', (time) => {
      const value = `2026-11-24T${time}`;
      expect(unwrapOk(parseDateTime(value))).toMatchObject({
        date: { value: '2026-11-24' },
        time: { value: time },
        value,
      });
    });

    it('preserves the calendar of the date', () => {
      const value = '2026-11-24T14:30[u-ca=dangi]';
      const parsed = unwrapOk(parseDateTime(value, { calendars }));
      expect(parsed).toMatchObject({
        date: { calendar: 'dangi', value: '2026-11-24[u-ca=dangi]' },
        time: { value: '14:30' },
        value,
      });
    });

    it.each([
      'abc',
      '',
      '2026-11-24 14:30',
      '2026-1-5T09:30',
      '2026-02-30T09:30',
      '2026-11-24',
      '2026-11-24T14:30[u-ca=gregory]',
    ])('classifies %j as an invalid date', (input) => {
      expect(parseDateTime(input, { calendars })).toEqual({ isOk: false, error: 'invalid-date' });
    });

    it.each([
      '2026-11-24T24:00',
      '2026-11-24T14:30:00',
      '2026-11-24T05:30:00.000Z',
      '2026-11-24T9:30',
      '2026-11-24T',
      '2026-11-24T9:30[u-ca=dangi]',
      '2026-11-24T14:30[Asia/Seoul]',
    ])('classifies %j as an invalid time', (input) => {
      expect(parseDateTime(input, { calendars })).toEqual({ isOk: false, error: 'invalid-time' });
    });
  });

  describe('formatDateTime', () => {
    it.each([
      ['2026-11-24', '2026-11-24T14:30'],
      ['2026-11-24[u-ca=dangi]', '2026-11-24T14:30[u-ca=dangi]'],
    ])('joins %s and a time', (date, expected) => {
      const dateValue = unwrapOk(parseDate(date, { calendars })).value;
      const timeValue = unwrapOk(parseTime('14:30')).value;
      expect(unwrapOk(formatDateTime(dateValue, timeValue))).toBe(expected);
    });

    it('rejects an end-of-day time even if it is a branded TimeString', () => {
      const date = unwrapOk(parseDate('2026-11-24')).value;
      const time = unwrapOk(formatTime(24, 0, { isEndOfDayAllowed: true }));
      expect(formatDateTime(date, time)).toEqual({ isOk: false, error: 'invalid-time' });
    });
  });

  describe('parts and ordering', () => {
    it('returns the lunar annotation with the date part', () => {
      const { value } = unwrapOk(parseDateTime('2026-11-24T14:30[u-ca=dangi]', { calendars }));
      expect(datePartOf(value)).toBe('2026-11-24[u-ca=dangi]');
      expect(timePartOf(value)).toBe('14:30');
    });

    it('round-trips Gregorian dates and minute-precision times', () => {
      fc.assert(
        fc.property(gregorianDay, hour, minute, (day, hours, minutes) => {
          const date = unwrapOk(formatDate(brandEpochDay(day)));
          const time = unwrapOk(formatTime(hours, minutes));
          const parsed = unwrapOk(parseDateTime(unwrapOk(formatDateTime(date, time))));
          expect(datePartOf(parsed.value)).toBe(date);
          expect(timePartOf(parsed.value)).toBe(time);
        }),
      );
    });

    it('sorts by day, hour, and minute in string order', () => {
      fc.assert(
        fc.property(
          gregorianDay,
          gregorianDay,
          hour,
          hour,
          minute,
          minute,
          (day, otherDay, hours, otherHours, minutes, otherMinutes) => {
            const date = unwrapOk(formatDate(brandEpochDay(day)));
            const otherDate = unwrapOk(formatDate(brandEpochDay(otherDay)));
            const time = unwrapOk(formatTime(hours, minutes));
            const otherTime = unwrapOk(formatTime(otherHours, otherMinutes));
            const otherMinute = unwrapOk(formatTime(hours, otherMinutes));
            const value = unwrapOk(formatDateTime(date, time));

            expect(value < unwrapOk(formatDateTime(otherDate, otherTime))).toBe(
              (day - otherDay || hours - otherHours || minutes - otherMinutes) < 0,
            );
            expect(value < unwrapOk(formatDateTime(date, otherTime))).toBe(
              (hours - otherHours || minutes - otherMinutes) < 0,
            );
            expect(value < unwrapOk(formatDateTime(date, otherMinute))).toBe(minutes < otherMinutes);
          },
        ),
      );
    });
  });
});

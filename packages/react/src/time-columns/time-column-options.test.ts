import { parseTime, type TimeString } from '@lunisolar-picker/calendar';
import { NO_TIME_BOUNDS, resolveTimeBounds } from '@lunisolar-picker/core';
import { describe, expect, it } from 'vitest';
import { buildBoundedTimeColumns, resolveHourPick, resolveMinutePick } from './time-column-options';

const bounds = resolveTimeBounds('09:30', '17:15');
const minuteStep = 15;

const timeOf = (input: string): TimeString => {
  const parsed = parseTime(input);
  if (!parsed.isOk) throw new Error(`Unexpected time: ${input}`);
  return parsed.value.value;
};

const disabledLabels = (options: readonly { readonly isDisabled: boolean; readonly label: string }[]) =>
  options.filter((option) => option.isDisabled).map((option) => option.label);

describe('buildBoundedTimeColumns', () => {
  it('disables hours with no minute inside the bounds', () => {
    const { hours } = buildBoundedTimeColumns({ bounds, minuteStep, selectedHour: null });

    expect(hours).toHaveLength(24);
    expect(disabledLabels(hours)).toEqual([
      '00',
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
    ]);
  });

  it('disables minutes outside the bounds for the selected hour', () => {
    expect(disabledLabels(buildBoundedTimeColumns({ bounds, minuteStep, selectedHour: 9 }).minutes)).toEqual([
      '00',
      '15',
    ]);
    expect(disabledLabels(buildBoundedTimeColumns({ bounds, minuteStep, selectedHour: 17 }).minutes)).toEqual([
      '30',
      '45',
    ]);
  });

  it('leaves every minute enabled when no hour is selected', () => {
    const { minutes } = buildBoundedTimeColumns({ bounds, minuteStep, selectedHour: null });

    expect(minutes.map((minute) => minute.label)).toEqual(['00', '15', '30', '45']);
    expect(disabledLabels(minutes)).toEqual([]);
  });
});

describe('resolveHourPick', () => {
  it('keeps the current minute when it fits the hour', () => {
    expect(resolveHourPick({ bounds, minuteStep, current: timeOf('14:00'), hour: 10 })).toBe('10:00');
  });

  it('keeps an off-step minute that fits the hour', () => {
    expect(resolveHourPick({ bounds: NO_TIME_BOUNDS, minuteStep: 5, current: timeOf('14:07'), hour: 9 })).toBe('09:07');
  });

  it('moves to the next enabled minute', () => {
    expect(resolveHourPick({ bounds, minuteStep, current: timeOf('14:10'), hour: 9 })).toBe('09:30');
  });

  it('falls back to the last enabled minute', () => {
    expect(resolveHourPick({ bounds, minuteStep, current: timeOf('14:45'), hour: 17 })).toBe('17:15');
  });

  it('starts from the first enabled minute without a value', () => {
    expect(resolveHourPick({ bounds, minuteStep, current: null, hour: 9 })).toBe('09:30');
  });

  it('returns nothing for an hour with no enabled minute', () => {
    expect(resolveHourPick({ bounds, minuteStep, current: timeOf('14:00'), hour: 8 })).toBeNull();
  });
});

describe('resolveMinutePick', () => {
  it('combines the current hour with the minute', () => {
    expect(resolveMinutePick({ bounds, minuteStep, current: timeOf('10:15'), minute: 45 })).toBe('10:45');
  });

  it('uses the first hour where the minute fits without a value', () => {
    expect(resolveMinutePick({ bounds, minuteStep, current: null, minute: 0 })).toBe('10:00');
    expect(resolveMinutePick({ bounds, minuteStep, current: null, minute: 45 })).toBe('09:45');
  });

  it('treats 24:00 as no value', () => {
    const endOfDay = parseTime('24:00', { isEndOfDayAllowed: true });
    if (!endOfDay.isOk) throw new Error('Unexpected time: 24:00');

    expect(resolveMinutePick({ bounds, minuteStep, current: endOfDay.value.value, minute: 45 })).toBe('09:45');
  });

  it('returns nothing when the minute is outside the bounds for the current hour', () => {
    expect(resolveMinutePick({ bounds, minuteStep, current: timeOf('09:30'), minute: 0 })).toBeNull();
  });
});

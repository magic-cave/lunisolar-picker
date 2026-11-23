import {
  type CalendarSystem,
  type DateString,
  epochDayOf,
  gregory,
  type ParsedDateTime,
  parseDateTime,
} from '@lunisolar-picker/calendar';
import { NO_TIME_BOUNDS, type TimeBounds } from '@lunisolar-picker/core';
import { formatOrNull } from '../value/format-or-null';

const DATE_LENGTH = 'YYYY-MM-DD'.length;
const FIRST_MINUTE = '00:00';
const LAST_MINUTE = '23:59';

export interface DateTimeBounds {
  readonly max: ParsedDateTime | null;
  readonly min: ParsedDateTime | null;
}

export type DateBounds = {
  readonly max: DateString | undefined;
  readonly min: DateString | undefined;
};

export const resolveDateTimeBounds = (
  min: string | undefined,
  max: string | undefined,
  calendars: readonly CalendarSystem[],
): DateTimeBounds => ({
  max: parseBoundary(max, LAST_MINUTE, calendars),
  min: parseBoundary(min, FIRST_MINUTE, calendars),
});

export const dateBoundsOf = ({ max, min }: DateTimeBounds): DateBounds => ({
  max: formatOrNull(max?.date.epochDay ?? null, gregory) ?? undefined,
  min: formatOrNull(min?.date.epochDay ?? null, gregory) ?? undefined,
});

export const timeBoundsOn = (date: DateString | null, { max, min }: DateTimeBounds): TimeBounds => {
  if (date === null) return NO_TIME_BOUNDS;
  const day = epochDayOf(date);
  return {
    max: day === max?.date.epochDay ? max.time.value : null,
    min: day === min?.date.epochDay ? min.time.value : null,
  };
};

const parseBoundary = (
  input: string | undefined,
  fallbackTime: string,
  calendars: readonly CalendarSystem[],
): ParsedDateTime | null => {
  if (typeof input !== 'string') return null;
  // Constraint: 역법 주석은 붙여 넣는 시각보다 뒤에 남겨야 함
  const dateTime =
    input[DATE_LENGTH] === 'T' ? input : `${input.slice(0, DATE_LENGTH)}T${fallbackTime}${input.slice(DATE_LENGTH)}`;
  const parsed = parseDateTime(dateTime, { calendars });
  return parsed.isOk ? parsed.value : null;
};

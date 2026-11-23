import { parseTime, type TimeString } from '@lunisolar-picker/calendar';

export interface TimeBounds {
  readonly max: TimeString | null;
  readonly min: TimeString | null;
}

export const NO_TIME_BOUNDS: TimeBounds = { max: null, min: null };

export const resolveTimeBounds = (min: string | null | undefined, max: string | null | undefined): TimeBounds => {
  const lower = parseBound(min);
  const upper = parseBound(max);
  return lower === null && upper === null ? NO_TIME_BOUNDS : { max: upper, min: lower };
};

export const timeBoundsReason = (time: TimeString, { min, max }: TimeBounds): 'before-min' | 'after-max' | null => {
  if (min !== null && time < min) return 'before-min';
  if (max !== null && time > max) return 'after-max';
  return null;
};

const parseBound = (input: string | null | undefined): TimeString | null => {
  if (input == null) return null;
  const result = parseTime(input, { isEndOfDayAllowed: true });
  return result.isOk ? result.value.value : null;
};

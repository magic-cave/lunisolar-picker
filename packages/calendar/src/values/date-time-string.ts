import { err, ok, type Result } from '../result';
import type { ValidationReason } from '../validation-reason';
import { type DateString, type ParseDateOptions, type ParsedDate, parseDate } from './date-string';
import { type ParsedTime, parseTime, type TimeString } from './time-string';

const DATE_END = 10;
const TIME_START = DATE_END + 1;
const TIME_END = TIME_START + 'HH:mm'.length;

declare const dateTimeStringBrand: unique symbol;

export type DateTimeString = string & { readonly [dateTimeStringBrand]: true };

export interface ParsedDateTime {
  readonly date: ParsedDate;
  readonly time: ParsedTime;
  readonly value: DateTimeString;
}

export const parseDateTime = (input: string, options?: ParseDateOptions): Result<ParsedDateTime, ValidationReason> => {
  if (input[DATE_END] !== 'T') return err('invalid-date');
  const annotationStart = input.indexOf('[u-ca=', TIME_START);
  const date = parseDate(input.slice(0, DATE_END) + (annotationStart < 0 ? '' : input.slice(annotationStart)), options);
  if (!date.isOk) return err('invalid-date');

  const time = parseTime(input.slice(TIME_START, annotationStart < 0 ? undefined : annotationStart));
  if (!time.isOk) return time;

  return ok({ date: date.value, time: time.value, value: input as DateTimeString }); // as: brand — 두 부분을 검증한 정규 값
};

export const datePartOf = (value: DateTimeString): DateString =>
  (value.slice(0, DATE_END) + value.slice(TIME_END)) as DateString; // as: brand — 날짜와 역법 주석은 함께 검증됨

export const formatDateTime = (date: DateString, time: TimeString): Result<DateTimeString, ValidationReason> => {
  const parsed = parseTime(time);
  if (!parsed.isOk) return parsed;
  const value = `${date.slice(0, DATE_END)}T${parsed.value.value}${date.slice(DATE_END)}`;
  return ok(value as DateTimeString); // as: brand — 정규 날짜와 시각을 조립함
};

export const timePartOf = (value: DateTimeString): TimeString => value.slice(TIME_START, TIME_END) as TimeString; // as: brand — 시각 부분은 조립 또는 파싱 단계에서 검증됨

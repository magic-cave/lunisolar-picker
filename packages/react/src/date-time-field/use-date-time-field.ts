import {
  type CalendarId,
  type CalendarSystem,
  type DateString,
  type DateTimeString,
  datePartOf,
  formatDateTime,
  gregory,
  LunisolarPickerError,
  parseDateTime,
  type TimeString,
  timePartOf,
  type ValidationReason,
} from '@lunisolar-picker/calendar';
import {
  canTakeAnotherDigit,
  createTimeFieldState,
  type DateConstraints,
  type DateFieldEvent,
  dateFieldResult,
  invalidBecause,
  NO_TIME_BOUNDS,
  type SegmentEvent,
  type SegmentGroup,
  type TimeBounds,
  type TimeFieldContext,
  type TimeFieldState,
  timeBoundsReason,
  timeFieldReducer,
  timeFieldResult,
  type Validity,
} from '@lunisolar-picker/core';
import { type HTMLAttributes, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type DataAttributeProps, partAttributes } from '../contract/data-attributes';
import {
  type DateFieldCore,
  selectedDayOf,
  useDateFieldSegments,
  useDateFieldStore,
} from '../date-field/use-date-field-core';
import { type SegmentDescription, type SegmentedField, useSegmentedField } from '../segments/use-segmented-field';
import type { SharedPickerProps, ValueChangeDetails } from '../settings/shared-picker-props';
import { type PickerSettings, usePickerSettings } from '../settings/use-picker-settings';
import { useStoreInstance } from '../store/use-store-instance';
import { compactObject } from '../utilities/compact-object';
import { createFocusLeaveListener } from '../utilities/focus-leave';
import { formatOrNull } from '../value/format-or-null';
import type { HiddenInputProps } from '../value/hidden-input';
import { isVisiblyInvalid } from '../value/is-visibly-invalid';
import type { ParsedControlledValue } from '../value/parse-controlled-value';
import { useParsedValue } from '../value/use-parsed-value';
import { useValueBridge } from '../value/use-value-bridge';
import { type DateBounds, dateBoundsOf, resolveDateTimeBounds, timeBoundsOn } from './date-time-bounds';

const DEFAULT_MINUTE_STEP = 1;
const INCOMPLETE: ValidationReason = 'incomplete';
const TIME_PART_DIGITS = 2;

export const fieldParts: unique symbol = Symbol('DateTimeField.parts');

type DateTimeParts = {
  readonly date: DateString | null;
  readonly time: TimeString | null;
};

type DateTimeFieldParts = {
  readonly date: DateFieldCore;
  readonly time: SegmentedField;
  readonly timeSegments: TimeFieldState['segments'];
};

export interface UseDateTimeFieldProps extends SharedPickerProps, Pick<DateConstraints, 'isDateDisabled'> {
  readonly defaultEntryCalendar?: CalendarId | undefined;
  readonly defaultValue?: string | null | undefined;
  readonly entryCalendar?: CalendarId | undefined;
  readonly max?: string | undefined;
  readonly min?: string | undefined;
  readonly minuteStep?: number | undefined;
  readonly onEntryCalendarChange?: ((calendar: CalendarId) => void) | undefined;
  readonly onValueChange?: ((value: DateTimeString | null, details: ValueChangeDetails) => void) | undefined;
  readonly separator?: string | undefined;
  readonly value?: string | null | undefined;
}

export interface DateTimeFieldApi {
  readonly [fieldParts]: DateTimeFieldParts;
  readonly dateBounds: DateBounds;
  readonly datePart: DateString | null;
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
  readonly isReadOnly: boolean;
  readonly timePart: TimeString | null;
  readonly validity: Validity;
  readonly value: DateTimeString | null;
  clear(): void;
  focus(): void;
  getHiddenInputProps(): HiddenInputProps;
  getRootProps(): HTMLAttributes<HTMLDivElement> & DataAttributeProps;
  setDatePart(date: DateString | null): void;
  setParts(date: DateString | null, time: TimeString | null): void;
  setTimePart(time: TimeString | null): void;
  timeBoundsOn(date: DateString | null): TimeBounds;
}

export const useDateTimeField = (props: UseDateTimeFieldProps): DateTimeFieldApi => {
  const settings = usePickerSettings(props);
  const { calendars, calendarKey } = settings;
  const { max, min, isDateDisabled } = props;
  const bounds = useMemo(() => resolveDateTimeBounds(min, max, calendars), [min, max, calendars]);
  const dateBounds = useMemo(() => dateBoundsOf(bounds), [bounds]);
  const controlled = useParsedValue(
    props.value,
    (input) => parseParts(input, calendars),
    String,
    props.onInvalidValue,
    calendarKey,
  );
  const [mountedDefault] = useState(() => props.defaultValue);
  const [initialParts] = useState(() =>
    controlled.isControlled ? controlled.value : parseParts(mountedDefault, calendars).value,
  );

  const dateStore = useDateFieldStore({
    constraints: compactObject({ ...dateBounds, isDateDisabled }),
    controlledSelected: selectedDayOf(controlled.value?.date ?? null),
    initialEntryCalendarId: props.entryCalendar ?? props.defaultEntryCalendar ?? gregory.id,
    initialSelected: selectedDayOf(initialParts?.date ?? null),
    isControlled: controlled.isControlled,
    requestedEntryCalendarId: props.entryCalendar,
    settings,
  });
  const minuteStep = props.minuteStep ?? DEFAULT_MINUTE_STEP;
  const timeContext = useMemo<TimeFieldContext>(
    () => ({ bounds: NO_TIME_BOUNDS, isEndOfDayAllowed: false, minuteStep }),
    [minuteStep],
  );
  const entryCalendarId = dateStore.state.entryCalendarId;
  const previousEntryCalendar = useRef(entryCalendarId);
  const shouldRebaseTime =
    controlled.isControlled && !calendars.some((calendar) => calendar.id === previousEntryCalendar.current);
  useLayoutEffect(() => {
    previousEntryCalendar.current = entryCalendarId;
  }, [entryCalendarId]);

  const timeStore = useStoreInstance(
    (previous: TimeFieldState | undefined) => {
      if (previous === undefined) return createTimeFieldState(initialParts?.time ?? null, timeContext);
      if (!shouldRebaseTime) return previous;
      // Constraint: 제어 날짜가 제거된 역법에서 즉시 옮겨질 때 시각도 같은 값으로 맞춰 중간 조합을 알리지 않음
      const synced = createTimeFieldState(controlled.value?.time ?? null, timeContext);
      return { ...synced, focusedIndex: previous.focusedIndex };
    },
    timeFieldReducer,
    timeContext,
    { resetKey: calendarKey },
  );

  const settledDate = useSettledState(dateStore.state);
  const settledTime = useSettledState(timeStore.state);
  const dateResult =
    settledDate === dateStore.state ? dateStore.result : dateFieldResult(settledDate, dateStore.context);
  const timeResult = timeFieldResult(settledTime, timeContext);
  const datePart = formatOrNull(dateResult.epochDay, dateStore.entryCalendar);
  const timePart = timeResult.time;
  const parts = useMemo(
    () => (datePart === null && timePart === null ? null : { date: datePart, time: timePart }),
    [datePart, timePart],
  );
  const value = formatParts(parts);
  const boundsForDate = (date: DateString | null): TimeBounds => timeBoundsOn(date, bounds);
  const reason = datePart === null || timePart === null ? null : timeBoundsReason(timePart, boundsForDate(datePart));
  const validity = invalidBecause([
    ...(value !== null || datePart === null ? dateResult.validity.reasons : []),
    ...timeResult.validity.reasons,
    ...(reason === null ? [] : [reason]),
    ...(value === null && parts !== null ? [INCOMPLETE] : []),
  ]);
  const isDisabled = props.disabled === true;
  const isReadOnly = props.readOnly === true;
  const isInvalid = isVisiblyInvalid({ invalid: props.invalid === true, reasons: validity.reasons });
  const isEditable = !isDisabled && !isReadOnly;
  const lastDateIndex = dateStore.state.segments.length - 1;

  const syncDatePart = (next: DateString | null): CalendarId => {
    const selected = selectedDayOf(next);
    const supported =
      selected === null || calendars.some((calendar) => calendar.id === selected.calendarId)
        ? selected
        : { ...selected, calendarId: gregory.id };
    const entryCalendarId = supported?.calendarId ?? dateStore.state.entryCalendarId;
    finishTyping(dateStore.state, dateStore.send);
    dateStore.send({ type: 'value.sync', selected: supported, entryCalendarId });
    return entryCalendarId;
  };
  const syncTimePart = (next: TimeString | null): void => {
    finishTyping(timeStore.state, timeStore.send);
    timeStore.send({ type: 'value.sync', time: next });
  };
  const syncParts = (next: DateTimeParts | null): void => {
    syncDatePart(next?.date ?? null);
    syncTimePart(next?.time ?? null);
  };

  const reportEntryCalendar = (calendar: CalendarId): void => {
    if (calendar !== dateStore.state.entryCalendarId) props.onEntryCalendarChange?.(calendar);
  };
  const setDatePart = (next: DateString | null): void => {
    if (isEditable) reportEntryCalendar(syncDatePart(next));
  };
  const setTimePart = (next: TimeString | null): void => {
    if (isEditable) syncTimePart(next);
  };
  const setParts = (nextDate: DateString | null, nextTime: TimeString | null): void => {
    if (!isEditable) return;
    const calendar = syncDatePart(nextDate);
    syncTimePart(nextTime);
    reportEntryCalendar(calendar);
  };

  const time = useSegmentedField({
    describeSegment: (index) => describeTimeSegment(timeStore.state, index, settings),
    focusedIndex: timeStore.state.focusedIndex,
    isDisabled,
    isInvalid,
    isReadOnly,
    isRequired: props.required === true,
    segmentPart: 'time-field-segment',
    sendCommand: (command) => {
      if (command.type === 'leapMonth.toggle') return;
      if (command.type === 'focus.shift' && command.amount < 0 && timeStore.state.focusedIndex === 0) {
        date.segmentedField.focusSegment(lastDateIndex);
        return;
      }
      timeStore.send(command);
    },
  });
  const sendDateCommand = (command: DateFieldEvent): void => {
    if (command.type === 'focus.shift' && command.amount > 0 && dateStore.state.focusedIndex === lastDateIndex) {
      time.focusSegment(0);
      return;
    }
    if (command.type === 'text.paste') {
      const pasted = parseParts(command.text.trim().replace(' ', 'T'), calendars).value;
      if (pasted !== null) {
        setParts(pasted.date, pasted.time);
        return;
      }
    }
    dateStore.send(command);
  };
  const date: DateFieldCore = useDateFieldSegments(
    { ...dateStore, result: { ...dateStore.result, validity }, send: sendDateCommand },
    {
      isDisabled,
      isInvalidFromOwner: isInvalid,
      isReadOnly,
      isRequired: props.required === true,
      separator: props.separator,
      settings,
    },
  );
  useMoveToTimeWhenDateCompletes(date, time);

  useValueBridge<DateTimeParts>({
    committedValue: parts,
    controlled,
    isEqual: sameParts,
    onValueChange: (next) => {
      // Constraint: 제거된 역법에서 부모 값으로 돌아가는 동작은 사용자 편집으로 알리지 않음
      if (!shouldRebaseTime) props.onValueChange?.(formatParts(next), { validity });
    },
    syncStore: syncParts,
    toPublic: (next) => (next?.date != null && next.time !== null ? next : null),
  });

  const focusDate = date.segmentedField.focusSegment;
  const focus = useCallback(() => focusDate(0), [focusDate]);
  const onFocusLeave = createFocusLeaveListener(props.onBlur);
  return {
    [fieldParts]: { date, time, timeSegments: timeStore.state.segments },
    clear: () => setParts(null, null),
    dateBounds,
    datePart,
    focus,
    getHiddenInputProps: () => ({
      disabled: props.disabled,
      form: props.form,
      name: props.name,
      onFocusRequest: focus,
      onFormReset: () => {
        if (!controlled.isControlled) syncParts(parseParts(mountedDefault, calendars).value);
      },
      required: props.required,
      value: value ?? '',
    }),
    getRootProps: () => ({
      role: 'group',
      onBlur: (event) => {
        // Constraint: 입력 상자의 React 자식인 포털에서 올라온 blur는 실제 입력 상자의 포커스 이동이 아님
        if (event.currentTarget.contains(event.target)) onFocusLeave(event);
      },
      ...partAttributes('date-time-field', {
        calendar: date.state.entryCalendarId,
        disabled: isDisabled,
        focused: date.segmentedField.isFocusWithin || time.isFocusWithin,
        invalid: isInvalid,
        readonly: isReadOnly,
      }),
    }),
    isDisabled,
    isInvalid,
    isReadOnly,
    setDatePart,
    setParts,
    setTimePart,
    timeBoundsOn: boundsForDate,
    timePart,
    validity,
    value,
  };
};

const parseParts = (
  input: string | null | undefined,
  calendars: readonly CalendarSystem[],
): ParsedControlledValue<DateTimeParts> => {
  if (!input) return { invalidReason: null, value: null };
  const parsed = parseDateTime(input, { calendars });
  if (!parsed.isOk) return { invalidReason: parsed.error, value: null };
  return { invalidReason: null, value: { date: datePartOf(parsed.value.value), time: timePartOf(parsed.value.value) } };
};

const sameParts = (first: DateTimeParts | null, second: DateTimeParts | null): boolean =>
  first?.date === second?.date && first?.time === second?.time;

const formatParts = (parts: DateTimeParts | null): DateTimeString | null => {
  if (parts === null || parts.date === null || parts.time === null) return null;
  const value = formatDateTime(parts.date, parts.time);
  return value.isOk ? value.value : null;
};

// Constraint: 동기화할 숫자가 입력 중 숫자와 같아도 입력 버퍼를 정리해 새 값을 확정함
const finishTyping = ({ focusedIndex, segments }: SegmentGroup<string>, send: (event: SegmentEvent) => void): void => {
  if (focusedIndex === null || !segments.some((segment) => segment.typedText !== '')) return;
  send({ type: 'segment.focus', index: focusedIndex });
};

// Constraint: 마지막 숫자가 더 들어갈 자리가 있으면 '143'을 14:03으로 알리지 않고 다음 숫자나 포커스 이동을 기다림
const useSettledState = <State extends SegmentGroup<string>>(state: State): State => {
  const settled = useRef(state);
  const segment = state.focusedIndex === null ? undefined : state.segments[state.focusedIndex];
  const isPending = segment !== undefined && segment.typedText !== '' && canTakeAnotherDigit(segment);
  useLayoutEffect(() => {
    if (!isPending) settled.current = state;
  }, [isPending, state]);
  return isPending ? settled.current : state;
};

const useMoveToTimeWhenDateCompletes = (date: DateFieldCore, time: SegmentedField): void => {
  const lastIndex = date.state.segments.length - 1;
  const lastSegment = date.state.segments[lastIndex];
  const isDateComplete =
    date.state.focusedIndex === lastIndex &&
    lastSegment !== undefined &&
    !canTakeAnotherDigit(lastSegment) &&
    date.result.epochDay !== null;
  const { focusSegment } = time;
  useLayoutEffect(() => {
    if (isDateComplete) focusSegment(0);
  }, [focusSegment, isDateComplete]);
};

const describeTimeSegment = (state: TimeFieldState, index: number, settings: PickerSettings): SegmentDescription => {
  const segment = state.segments[index];
  if (segment === undefined)
    throw new LunisolarPickerError(`DateTimeField time segment index ${index} is out of range`);
  const { locale } = settings;
  const valueDisplay = segment.value === null ? null : String(segment.value).padStart(TIME_PART_DIGITS, '0');
  const placeholder = locale.field.placeholder[segment.kind];
  return {
    canToggleLeapMonth: false,
    displayText: segment.typedText === '' ? (valueDisplay ?? placeholder) : segment.typedText,
    isPlaceholder: segment.value === null && segment.typedText === '',
    label: locale.labels[segment.kind],
    maxValue: segment.maxValue,
    minValue: segment.minValue,
    value: segment.value,
    valueText: valueDisplay ?? placeholder,
  };
};

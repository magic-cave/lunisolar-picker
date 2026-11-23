import { type DateString, type DateTimeString, formatDateTime, type TimeString } from '@lunisolar-picker/calendar';
import type { DateConstraints } from '@lunisolar-picker/core';
import { type FocusEvent, type ReactElement, type ReactNode, type Ref, useImperativeHandle, useRef } from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateTimeField,
  type DateTimeFieldApi,
  HiddenInput,
  TimeList,
  type UseCalendarProps,
  type UseDateTimeFieldProps,
  useControllableState,
  useDateTimeField,
  usePickerSettings,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { PickerClearButton } from './picker-clear-button';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps } from './trigger-render-props';

const DEFAULT_MINUTE_STEP = 30;
const FIELD_SEGMENTS = `[${PART_ATTRIBUTE}="date-field"],[${PART_ATTRIBUTE}="time-field"]`;

type PendingFieldChange = {
  readonly notify: () => void;
  readonly value: DateTimeString;
};

type CalendarDisplayProps = Pick<
  UseCalendarProps,
  'defaultDisplayCalendar' | 'displayCalendar' | 'getCellLabel' | 'onDisplayCalendarChange'
>;

export interface DateTimePickerProps
  extends Omit<UseDateTimeFieldProps, 'defaultEntryCalendar' | 'entryCalendar' | 'onEntryCalendarChange'>,
    PickerOpenProps,
    CalendarDisplayProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly isClearable?: boolean | undefined;
  readonly onPick?: ((value: DateTimeString) => void) | undefined;
  readonly presentation?: 'popover' | undefined;
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
}

export const DateTimePicker = (props: DateTimePickerProps): ReactElement => {
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    defaultOpen,
    id,
    isClearable = true,
    minuteStep = DEFAULT_MINUTE_STEP,
    onOpenChange,
    onPick,
    open,
    ref,
    renderCell,
  } = props;
  const { locale, calendars, weekStartsOn } = usePickerSettings(props);
  const { labels } = locale;
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const pendingFieldChange = useRef<PendingFieldChange | null>(null);
  const field = useDateTimeField({
    ...props,
    minuteStep,
    onValueChange: (next, details) => {
      const pending = pendingFieldChange.current;
      pendingFieldChange.current = null;
      props.onValueChange?.(next, details);
      if (pending?.value === next) pending.notify();
    },
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useImperativeHandle(ref, () => ({ focus: field.focus }), [field.focus]);

  const afterFieldChange = (value: DateTimeString, notify: () => void): void => {
    if (field.value === value) notify();
    // Constraint: 고르기나 닫힘 콜백에서 부모가 picker를 언마운트할 수 있어 새 값을 먼저 알림
    else pendingFieldChange.current = { notify, value };
  };
  const reportPick = (date: DateString | null, time: TimeString | null, shouldClose = false): void => {
    if (date === null || time === null || (!onPick && !shouldClose)) return;
    const value = formatDateTime(date, time);
    if (!value.isOk) return;
    afterFieldChange(value.value, () => {
      onPick?.(value.value);
      if (shouldClose) setOpen(false);
    });
  };
  const pickTime = (time: TimeString): void => {
    field.setTimePart(time);
    reportPick(field.datePart, time, true);
  };
  const leaveField = (event: FocusEvent<HTMLDivElement>): void => {
    const { currentTarget, target, relatedTarget } = event;
    if (isFieldSegment(currentTarget, target) && !isFieldSegment(currentTarget, relatedTarget)) props.onBlur?.();
  };
  const clear = (): void => {
    field.focus();
    field.clear();
  };
  const renderTrigger = (triggerProps: PickerTriggerProps): ReactElement => (
    <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDateTime} icon={<CalendarIcon />} />
  );

  const timeBounds = field.timeBoundsOn(field.datePart);
  const dateConstraints = dateConstraintsFor(field.dateBounds, props.isDateDisabled);
  const isClearShown =
    isClearable && (field.datePart !== null || field.timePart !== null) && !field.isDisabled && !field.isReadOnly;
  return (
    <div className={className} {...partAttributes('date-time-picker', { invalid: field.isInvalid, open: isOpen })}>
      <DateTimeField.View
        api={field}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        id={id}
        render={(rootProps) => <div {...rootProps} {...{ onBlur: leaveField }} />}
      >
        <DateTimeField.Date />
        <DateTimeField.Time />
        {isClearShown ? <PickerClearButton label={labels.clear} onClear={clear} /> : null}
        <PickerSurface
          isDisabled={field.isDisabled || field.isReadOnly}
          isOpen={isOpen}
          isReadOnly={field.isReadOnly}
          label={ariaLabel ?? labels.chooseDateTime}
          onOpenChange={setOpen}
          presentation="popover"
          renderTrigger={renderTrigger}
          triggerRef={triggerRef}
        >
          <div {...partAttributes('date-time-panel')}>
            <Calendar.Root
              {...dateConstraints}
              calendars={calendars}
              defaultDisplayCalendar={props.defaultDisplayCalendar}
              displayCalendar={props.displayCalendar}
              getCellLabel={props.getCellLabel}
              locale={locale}
              numberOfMonths={1}
              onDisplayCalendarChange={props.onDisplayCalendarChange}
              onPick={(date) => reportPick(date, field.timePart)}
              onValueChange={field.setDatePart}
              timeZone={props.timeZone}
              today={props.today}
              value={field.datePart}
              weekStartsOn={weekStartsOn}
            >
              <Calendar.Layout renderCell={renderCell} />
            </Calendar.Root>
            <TimeList.Root
              aria-label={labels.chooseTime}
              max={timeBounds.max ?? undefined}
              min={timeBounds.min ?? undefined}
              minuteStep={minuteStep}
              onPick={pickTime}
              tabIndex={-1}
              value={field.timePart}
            />
          </div>
        </PickerSurface>
      </DateTimeField.View>
      <HiddenInput {...field.getHiddenInputProps()} />
    </div>
  );
};

const dateConstraintsFor = (
  { min, max }: DateTimeFieldApi['dateBounds'],
  isDateDisabled: DateTimePickerProps['isDateDisabled'],
): DateConstraints => ({
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
  ...(isDateDisabled === undefined ? {} : { isDateDisabled }),
});

const isFieldSegment = (box: HTMLElement, target: EventTarget | null): boolean =>
  target instanceof Element && box.contains(target.closest(FIELD_SEGMENTS));

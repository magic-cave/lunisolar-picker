import {
  type CalendarSystem,
  calendarIdOf,
  type DateString,
  type DateTimeString,
  epochDayOf,
  formatDate,
  formatDateTime,
  type TimeString,
} from '@lunisolar-picker/calendar';
import { type CommitMode, type DateConstraints, timeBoundsReason, validateDate } from '@lunisolar-picker/core';
import {
  type FocusEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { PART_ATTRIBUTE, partAttributes } from '../contract/data-attributes';
import {
  Calendar,
  type CellRenderInfo,
  DateTimeField,
  type DateTimeFieldApi,
  HiddenInput,
  type PickerSettings,
  type Presentation,
  type ResolvedPresentation,
  TimeColumns,
  TimeList,
  type UseCalendarProps,
  type UseDateTimeFieldProps,
  useControllableState,
  useDateTimeField,
  usePickerSettings,
  usePresentation,
} from '../index';
import type { PickerOpenProps } from './date-picker';
import { CalendarIcon, DefaultTrigger } from './default-trigger';
import { formatDisplayDate } from './format-display-value';
import { PickerClearButton } from './picker-clear-button';
import { PickerCloseFooter, PickerFooter } from './picker-footer';
import { PickerSurface } from './picker-surface';
import type { PickerTriggerProps, TriggerRenderProps } from './trigger-render-props';
import { useAppTriggerProps } from './use-app-trigger-props';

const DEFAULT_MINUTE_STEP = 30;
const FIELD_SEGMENTS = `[${PART_ATTRIBUTE}="date-field"],[${PART_ATTRIBUTE}="time-field"]`;

type CalendarDisplayProps = Pick<
  UseCalendarProps,
  'defaultDisplayCalendar' | 'displayCalendar' | 'getCellLabel' | 'onDisplayCalendarChange'
>;

type DateTimePanelProps = {
  readonly afterFieldChange: (value: DateTimeString, notify: () => void) => void;
  readonly field: DateTimeFieldApi;
  readonly minuteStep: number;
  readonly onClose: () => void;
  readonly picker: DateTimePickerProps;
  readonly presentation: ResolvedPresentation;
  readonly settings: PickerSettings;
  readonly timeLayout: TimeLayout;
};

type DateTimeParts = {
  readonly date: DateString | null;
  readonly time: TimeString | null;
};

type PendingFieldChange = {
  readonly notify: () => void;
  readonly value: DateTimeString;
};

export type TimeLayout = 'columns' | 'list';

export interface DateTimePickerProps
  extends Omit<UseDateTimeFieldProps, 'defaultEntryCalendar' | 'entryCalendar' | 'onEntryCalendarChange'>,
    PickerOpenProps,
    CalendarDisplayProps {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly className?: string | undefined;
  readonly commitMode?: CommitMode | undefined;
  readonly footer?: ReactNode;
  readonly id?: string | undefined;
  readonly isClearable?: boolean | undefined;
  readonly onPick?: ((value: DateTimeString) => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly presentation?: Presentation | undefined;
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly renderCell?: ((info: CellRenderInfo) => ReactNode) | undefined;
  readonly renderTrigger?: ((props: TriggerRenderProps) => ReactElement) | undefined;
  // Goal: 'columns'는 시 칸·분 칸을 따로 둬 1분·5분 간격에서도 시를 빨리 바꿈. 시 고르기는 값만 바꾸고 분을 골라야 고르기 완료(onPick)와 닫힘이 일어남
  readonly timeLayout?: TimeLayout | undefined;
}

export const DateTimePicker = (props: DateTimePickerProps): ReactElement => {
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    commitMode = 'immediate',
    defaultOpen,
    id,
    isClearable = true,
    minuteStep = DEFAULT_MINUTE_STEP,
    onOpenChange,
    open,
    placeholder = '',
    presentation = 'auto',
    ref,
    renderTrigger,
    timeLayout = 'list',
  } = props;
  const settings = usePickerSettings(props);
  const { labels } = settings.locale;
  const resolvedPresentation = usePresentation(presentation);
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
  const labelProps = {
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    id,
  };
  const toAppTriggerProps = useAppTriggerProps({ isOpen, labelProps, onBlur: props.onBlur });
  const focusInput = (): void => {
    if (renderTrigger) triggerRef.current?.focus();
    else field.focus();
  };
  useImperativeHandle(ref, () => ({ focus: focusInput }));

  const afterFieldChange = (value: DateTimeString, notify: () => void): void => {
    if (field.value === value) notify();
    // Constraint: 고르기나 닫힘 콜백에서 부모가 picker를 언마운트할 수 있어 새 값을 먼저 알림
    else pendingFieldChange.current = { notify, value };
  };
  const clear = (): void => {
    focusInput();
    field.clear();
  };
  const leaveField = (event: FocusEvent<HTMLDivElement>): void => {
    const { currentTarget, target, relatedTarget } = event;
    if (isFieldSegment(currentTarget, target) && !isFieldSegment(currentTarget, relatedTarget)) props.onBlur?.();
  };
  const renderPickerTrigger = (triggerProps: PickerTriggerProps): ReactElement =>
    renderTrigger ? (
      renderTrigger({
        displayValue:
          field.value === null
            ? ''
            : `${formatDisplayDate(field.datePart, settings, props.separator)} ${field.timePart}`,
        isOpen,
        placeholder,
        triggerProps: toAppTriggerProps(triggerProps),
      })
    ) : (
      <DefaultTrigger triggerProps={triggerProps} label={labels.chooseDateTime} icon={<CalendarIcon />} />
    );

  const isClearShown =
    isClearable && (field.datePart !== null || field.timePart !== null) && !field.isDisabled && !field.isReadOnly;
  const clearButton = isClearShown ? <PickerClearButton label={labels.clear} onClear={clear} /> : null;
  const surface = (
    <PickerSurface
      isDisabled={field.isDisabled || (field.isReadOnly && !renderTrigger)}
      isOpen={isOpen}
      isReadOnly={field.isReadOnly}
      label={ariaLabel ?? labels.chooseDateTime}
      onOpenChange={setOpen}
      presentation={resolvedPresentation}
      renderTrigger={renderPickerTrigger}
      triggerRef={triggerRef}
    >
      <DateTimePanel
        key={commitMode}
        afterFieldChange={afterFieldChange}
        field={field}
        minuteStep={minuteStep}
        onClose={() => setOpen(false)}
        picker={props}
        presentation={resolvedPresentation}
        settings={settings}
        timeLayout={timeLayout}
      />
    </PickerSurface>
  );
  return (
    <div className={className} {...partAttributes('date-time-picker', { invalid: field.isInvalid, open: isOpen })}>
      {renderTrigger ? (
        <>
          {surface}
          {clearButton}
        </>
      ) : (
        <DateTimeField.View
          api={field}
          {...labelProps}
          render={(rootProps) => <div {...rootProps} {...{ onBlur: leaveField }} />}
        >
          <DateTimeField.Date />
          <DateTimeField.Time />
          {clearButton}
          {surface}
        </DateTimeField.View>
      )}
      <HiddenInput {...field.getHiddenInputProps()} onFocusRequest={focusInput} />
    </div>
  );
};

const DateTimePanel = ({
  afterFieldChange,
  field,
  minuteStep,
  onClose,
  picker,
  presentation,
  settings: { calendars, locale, weekStartsOn },
  timeLayout,
}: DateTimePanelProps): ReactElement => {
  // Constraint: 표면이 열릴 때만 마운트되므로 닫거나 취소하면 초안을 버림
  const [draft, setDraft] = useState<DateTimeParts>(() => ({ date: field.datePart, time: field.timePart }));
  const isConfirmMode = picker.commitMode === 'confirm';
  const date = isConfirmMode ? dateInAvailableCalendar(draft.date, calendars) : field.datePart;
  if (isConfirmMode && date !== draft.date) setDraft({ ...draft, date });
  const time = isConfirmMode ? draft.time : field.timePart;
  const dateConstraints = dateConstraintsFor(field.dateBounds, picker.isDateDisabled);
  const timeBounds = field.timeBoundsOn(date);

  const reportPick = (pickedDate: DateString | null, pickedTime: TimeString | null, shouldClose = false): void => {
    const value = combinedValue(pickedDate, pickedTime);
    if (value === null) return;
    if (isConfirmMode) {
      picker.onPick?.(value);
      return;
    }
    afterFieldChange(value, () => {
      picker.onPick?.(value);
      if (shouldClose) onClose();
    });
  };
  const selectDate = (next: DateString | null): void => {
    if (isConfirmMode) setDraft((previous) => ({ ...previous, date: next }));
    else field.setDatePart(next);
  };
  const selectTime = (next: TimeString): void => {
    if (isConfirmMode) setDraft((previous) => ({ ...previous, time: next }));
    else field.setTimePart(next);
  };
  const pickTime = (next: TimeString): void => {
    selectTime(next);
    reportPick(date, next, true);
  };

  const canConfirm =
    isConfirmMode &&
    date !== null &&
    time !== null &&
    validateDate(date, dateConstraints, { calendars }).isValid &&
    timeBoundsReason(time, timeBounds) === null;
  const confirm = (): void => {
    const value = canConfirm ? combinedValue(date, time) : null;
    if (value === null) return;
    field.setParts(date, time);
    afterFieldChange(value, onClose);
  };

  return (
    <>
      <div {...partAttributes('date-time-panel')}>
        <Calendar.Root
          {...dateConstraints}
          calendars={calendars}
          defaultDisplayCalendar={picker.defaultDisplayCalendar}
          displayCalendar={picker.displayCalendar}
          getCellLabel={picker.getCellLabel}
          locale={locale}
          numberOfMonths={1}
          onDisplayCalendarChange={picker.onDisplayCalendarChange}
          onPick={(next) => reportPick(next, time)}
          onValueChange={selectDate}
          timeZone={picker.timeZone}
          today={picker.today}
          value={date}
          weekStartsOn={weekStartsOn}
        >
          <Calendar.Layout renderCell={picker.renderCell} />
        </Calendar.Root>
        {timeLayout === 'columns' ? (
          <TimeColumns.Root
            aria-label={locale.labels.chooseTime}
            hourLabel={locale.labels.hour}
            max={timeBounds.max ?? undefined}
            min={timeBounds.min ?? undefined}
            minuteLabel={locale.labels.minute}
            minuteStep={minuteStep}
            // Constraint: 분 고르기는 onValueChange 뒤에 onPick이 오므로 값 반영은 onValueChange에 맡기고 onPick에서는 알림·닫기만 함
            onPick={(next) => reportPick(date, next, true)}
            onValueChange={selectTime}
            value={time}
          />
        ) : (
          <TimeList.Root
            aria-label={locale.labels.chooseTime}
            max={timeBounds.max ?? undefined}
            min={timeBounds.min ?? undefined}
            minuteStep={minuteStep}
            onPick={pickTime}
            tabIndex={-1}
            value={time}
          />
        )}
      </div>
      {picker.footer}
      {isConfirmMode ? (
        <PickerFooter isConfirmDisabled={!canConfirm} labels={locale.labels} onCancel={onClose} onConfirm={confirm} />
      ) : null}
      {!isConfirmMode && presentation === 'sheet' ? <PickerCloseFooter label={locale.labels.close} /> : null}
    </>
  );
};

const combinedValue = (date: DateString | null, time: TimeString | null): DateTimeString | null => {
  if (date === null || time === null) return null;
  const result = formatDateTime(date, time);
  return result.isOk ? result.value : null;
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

const dateInAvailableCalendar = (date: DateString | null, calendars: readonly CalendarSystem[]): DateString | null => {
  if (date === null || calendars.some((calendar) => calendar.id === calendarIdOf(date))) return date;
  const solar = formatDate(epochDayOf(date));
  return solar.isOk ? solar.value : null;
};

import type { TimeString } from '@lunisolar-picker/calendar';
import { type ColumnOption, resolveTimeBounds, VALID } from '@lunisolar-picker/core';
import { type HTMLAttributes, type KeyboardEvent, type ReactElement, type RefObject, useMemo, useRef } from 'react';
import { partAttributes } from '../contract/data-attributes';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { ListboxColumn, type ListboxOption } from '../time-list/listbox-column';
import { mergeProps } from '../utilities/merge-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { parseWellFormedTime } from '../value/parse-controlled-value';
import { buildBoundedTimeColumns, parseDayTime, resolveHourPick, resolveMinutePick } from './time-column-options';

const DEFAULT_MINUTE_STEP = 30;
const OPTION_VALUE_DIGITS = 2;
const TAB_STOP_SELECTOR = '[role="option"][tabindex="0"]';

export interface TimeColumnsRootProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> {
  readonly 'aria-label': string;
  readonly defaultValue?: string | null | undefined;
  readonly hourLabel: string;
  readonly max?: string | undefined;
  readonly min?: string | undefined;
  readonly minuteLabel: string;
  readonly minuteStep?: number | undefined;
  // Goal: 분 칸 고르기마다(같은 분을 다시 골라도) 알림. 시 칸 고르기는 시각을 다 고른 것이 아니라 부르지 않음
  readonly onPick?: ((value: TimeString) => void) | undefined;
  readonly onValueChange?: ((value: TimeString, details: ValueChangeDetails) => void) | undefined;
  readonly value?: string | null | undefined;
}

// Goal: 1분·5분 간격처럼 한 줄 목록이 길어질 때 시와 분을 따로 골라 시 단위로 빠르게 옮김
// Constraint: 콜백·통제 규칙은 TimeList와 같음. 24:00은 칸이 없으므로 아무것도 선택하지 않음
export const TimeColumnsRoot = ({
  defaultValue,
  hourLabel,
  max,
  min,
  minuteLabel,
  minuteStep = DEFAULT_MINUTE_STEP,
  onPick,
  onValueChange,
  value,
  ...domProps
}: TimeColumnsRootProps): ReactElement => {
  const [selectedTime, setSelectedTime] = useControllableState<TimeString | null>(
    value === undefined ? undefined : parseWellFormedTime(value).value,
    parseWellFormedTime(defaultValue).value,
    undefined,
  );
  const bounds = useMemo(() => resolveTimeBounds(min, max), [min, max]);
  const selectedParts = parseDayTime(selectedTime);
  const selectedHour = selectedParts?.hour ?? null;
  const { hourOptions, minuteOptions } = useMemo(() => {
    const { hours, minutes } = buildBoundedTimeColumns({ bounds, minuteStep, selectedHour });
    return { hourOptions: hours.map(toListboxOption), minuteOptions: minutes.map(toListboxOption) };
  }, [bounds, minuteStep, selectedHour]);
  const hourColumnRef = useRef<HTMLUListElement | null>(null);
  const minuteColumnRef = useRef<HTMLUListElement | null>(null);

  const changeValue = (next: TimeString): void => {
    if (next === selectedTime) return;
    setSelectedTime(next);
    onValueChange?.(next, { validity: VALID });
  };

  const chooseHour = (hour: string): void => {
    const next = resolveHourPick({ bounds, current: selectedTime, hour: Number(hour), minuteStep });
    if (next !== null) changeValue(next);
  };

  const chooseMinute = (minute: string): void => {
    const next = resolveMinutePick({ bounds, current: selectedTime, minute: Number(minute), minuteStep });
    if (next === null) return;
    changeValue(next);
    onPick?.(next);
  };

  // Constraint: Biome의 role 규칙은 JSX에 직접 쓴 role만 보므로 달력 격자처럼 role을 속성 객체로 펼침 (preflight 2.7)
  const groupProps = mergeProps({ role: 'group', ...partAttributes('time-columns') }, domProps);

  return (
    <div {...groupProps}>
      <ListboxColumn
        aria-label={hourLabel}
        hasAutofocus
        onChoose={chooseHour}
        onKeyDown={focusColumnOnKey('ArrowRight', minuteColumnRef)}
        options={hourOptions}
        part="time-column"
        ref={hourColumnRef}
        selectedValue={selectedParts === null ? null : padOptionValue(selectedParts.hour)}
      />
      <ListboxColumn
        aria-label={minuteLabel}
        hasAutofocus={false}
        onChoose={chooseMinute}
        onKeyDown={focusColumnOnKey('ArrowLeft', hourColumnRef)}
        options={minuteOptions}
        part="time-column"
        ref={minuteColumnRef}
        selectedValue={selectedParts === null ? null : padOptionValue(selectedParts.minute)}
      />
    </div>
  );
};

// Goal: 좌우 화살표로 다른 칸의 탭 정지점으로 옮김. 키 처리를 칸 안에서만 하므로 달력 격자의 좌우 이동과 겹치지 않음
const focusColumnOnKey =
  (key: 'ArrowLeft' | 'ArrowRight', targetColumnRef: RefObject<HTMLUListElement | null>) =>
  (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.key !== key) return;
    const tabStop = targetColumnRef.current?.querySelector(TAB_STOP_SELECTOR);
    if (!(tabStop instanceof HTMLElement)) return;
    event.preventDefault();
    tabStop.focus();
  };

// Constraint: 옵션 값은 고정 폭 두 자리 문자열이라 ListboxColumn의 문자열 비교가 숫자 순서와 같음
const padOptionValue = (part: number): string => String(part).padStart(OPTION_VALUE_DIGITS, '0');

const toListboxOption = (option: ColumnOption<number>): ListboxOption<string> => ({
  isDisabled: option.isDisabled,
  label: option.label,
  value: padOptionValue(option.value),
});

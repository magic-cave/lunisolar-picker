import type { TimeString } from '@lunisolar-picker/calendar';
import { resolveTimeBounds, timeBoundsReason, VALID } from '@lunisolar-picker/core';
import { type HTMLAttributes, type ReactElement, useMemo } from 'react';
import type { ValueChangeDetails } from '../settings/shared-picker-props';
import { useControllableState } from '../utilities/use-controllable-state';
import { parseWellFormedTime } from '../value/parse-controlled-value';
import { listTimes } from './list-times';
import { ListboxColumn, type ListboxOption } from './listbox-column';

const DEFAULT_MINUTE_STEP = 30;

export interface TimeListRootProps
  extends Omit<HTMLAttributes<HTMLUListElement>, 'children' | 'defaultValue' | 'onChange'> {
  readonly 'aria-label': string;
  readonly defaultValue?: string | null | undefined;
  readonly isEndOfDayAllowed?: boolean | undefined;
  readonly max?: string | undefined;
  readonly min?: string | undefined;
  readonly minuteStep?: number | undefined;
  // Goal: 받아들인 사용자 고르기마다(이미 고른 시각을 다시 골라도) 알림. 완성형 picker가 닫을 때를 정함. onValueChange는 값이 바뀔 때만
  readonly onPick?: ((value: TimeString) => void) | undefined;
  readonly onValueChange?: ((value: TimeString, details: ValueChangeDetails) => void) | undefined;
  readonly value?: string | null | undefined;
}

// Goal: 편성표처럼 정해진 간격의 시각을 목록에서 고름. 기기 로케일과 무관하게 24시간제 값 문자열을 그대로 보임 (계약 §3.3 TimeField)
// Constraint: 콜백은 사용자 조작에만 호출 시점에 부르고, 부모가 거부하면 부모 값을 보임(달력과 같은 규칙). 허용되지 않은 24:00은 형식 오류가 아니라 고를 항목이 없는 값이라 아무것도 선택하지 않음
export const TimeListRoot = ({
  defaultValue,
  isEndOfDayAllowed = false,
  max,
  min,
  minuteStep = DEFAULT_MINUTE_STEP,
  onPick,
  onValueChange,
  value,
  ...domProps
}: TimeListRootProps): ReactElement => {
  const options = useMemo((): readonly ListboxOption<TimeString>[] => {
    const bounds = resolveTimeBounds(min, max);
    return listTimes(minuteStep, isEndOfDayAllowed).map((time) => ({
      isDisabled: timeBoundsReason(time, bounds) !== null,
      label: time,
      value: time,
    }));
  }, [min, max, minuteStep, isEndOfDayAllowed]);
  const [selectedTime, setSelectedTime] = useControllableState<TimeString | null>(
    value === undefined ? undefined : parseWellFormedTime(value).value,
    parseWellFormedTime(defaultValue).value,
    undefined,
  );

  const choose = (time: TimeString): void => {
    if (time !== selectedTime) {
      setSelectedTime(time);
      onValueChange?.(time, { validity: VALID });
    }
    onPick?.(time);
  };

  return (
    <ListboxColumn
      {...domProps}
      hasAutofocus
      onChoose={choose}
      options={options}
      part="time-list"
      selectedValue={selectedTime}
    />
  );
};

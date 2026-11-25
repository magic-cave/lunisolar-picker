import { formatTime, parseTime, type TimeString } from '@lunisolar-picker/calendar';
import { buildTimeColumns, type ColumnOption, type TimeBounds, timeBoundsReason } from '@lunisolar-picker/core';

type BoundedTimeColumns = {
  readonly hours: readonly ColumnOption<number>[];
  readonly minutes: readonly ColumnOption<number>[];
};

type TimeColumnsInput = { readonly bounds: TimeBounds; readonly minuteStep: number };

// Goal: 시 칸은 그 시에 고를 분이 하나라도 있는지, 분 칸은 고른 시와 합친 시각이 범위 안인지로 비활성을 정함
// Constraint: 고른 시가 없으면 어느 시와 합칠지 모르므로 분 칸은 비활성 없이 보임
export const buildBoundedTimeColumns = ({
  bounds,
  minuteStep,
  selectedHour,
}: TimeColumnsInput & { readonly selectedHour: number | null }): BoundedTimeColumns => {
  const { hours, minutes } = buildTimeColumns({ isEndOfDayAllowed: false, minuteStep });
  return {
    hours: hours.map((hour) => ({
      ...hour,
      isDisabled: !minutes.some((minute) => isWithinBounds({ bounds, hour: hour.value, minute: minute.value })),
    })),
    minutes:
      selectedHour === null
        ? minutes
        : minutes.map((minute) => ({
            ...minute,
            isDisabled: !isWithinBounds({ bounds, hour: selectedHour, minute: minute.value }),
          })),
  };
};

// Goal: 시를 바꿔도 고른 분을 되도록 지킴. 간격에 안 맞는 분(09:07)도 범위 안이면 그대로 둠
// Constraint: 분이 그 시에서 범위 밖이면 그 뒤로 가장 가까운 활성 분, 없으면 가장 늦은 활성 분으로 맞춤. 활성 분이 없는 시면 null
export const resolveHourPick = ({
  bounds,
  current,
  hour,
  minuteStep,
}: TimeColumnsInput & { readonly current: TimeString | null; readonly hour: number }): TimeString | null => {
  const enabledMinutes = buildBoundedTimeColumns({ bounds, minuteStep, selectedHour: hour })
    .minutes.filter((minute) => !minute.isDisabled)
    .map((minute) => minute.value);
  const firstMinute = enabledMinutes[0];
  const lastMinute = enabledMinutes.at(-1);
  if (firstMinute === undefined || lastMinute === undefined) return null;
  const currentMinute = parseDayTime(current)?.minute ?? null;
  if (currentMinute === null) return timeAt(hour, firstMinute);
  if (isWithinBounds({ bounds, hour, minute: currentMinute })) return timeAt(hour, currentMinute);
  return timeAt(hour, enabledMinutes.find((minute) => minute > currentMinute) ?? lastMinute);
};

// Constraint: 값이 없으면 그 분이 범위 안인 첫 시로 정함. 범위 밖 시각이 되면 null
export const resolveMinutePick = ({
  bounds,
  current,
  minute,
  minuteStep,
}: TimeColumnsInput & { readonly current: TimeString | null; readonly minute: number }): TimeString | null => {
  const currentHour = parseDayTime(current)?.hour;
  if (currentHour !== undefined)
    return isWithinBounds({ bounds, hour: currentHour, minute }) ? timeAt(currentHour, minute) : null;
  const firstHour = buildTimeColumns({ isEndOfDayAllowed: false, minuteStep }).hours.find((hour) =>
    isWithinBounds({ bounds, hour: hour.value, minute }),
  );
  return firstHour === undefined ? null : timeAt(firstHour.value, minute);
};

const isWithinBounds = ({
  bounds,
  hour,
  minute,
}: {
  readonly bounds: TimeBounds;
  readonly hour: number;
  readonly minute: number;
}): boolean => {
  const time = timeAt(hour, minute);
  return time !== null && timeBoundsReason(time, bounds) === null;
};

// Constraint: 두 칸에는 24:00이 없으므로 24:00 값은 고른 시·분이 없는 것으로 봄
const parseDayTime = (time: TimeString | null): { readonly hour: number; readonly minute: number } | null => {
  if (time === null) return null;
  const parsed = parseTime(time);
  return parsed.isOk ? parsed.value : null;
};

const timeAt = (hour: number, minute: number): TimeString | null => {
  const time = formatTime(hour, minute);
  return time.isOk ? time.value : null;
};

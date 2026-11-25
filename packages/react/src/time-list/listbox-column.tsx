import {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type Ref,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type PartName, partAttributes } from '../contract/data-attributes';
import { AUTOFOCUS_ATTRIBUTE } from '../focus/focusable-elements';
import { mergeProps } from '../utilities/merge-props';

const FIRST_INDEX = 0;
const MISSING_INDEX = -1;

type KeyMoveInput = {
  readonly disabledOptions: readonly boolean[];
  readonly focusedIndex: number;
  readonly key: 'ArrowDown' | 'ArrowUp' | 'End' | 'Home';
};

export type ListboxOption<Value extends string> = {
  readonly isDisabled: boolean;
  readonly label: string;
  readonly value: Value;
};

type RovingState<Value extends string> = {
  readonly focusedValue: Value | null;
  // Goal: 탭 정지점을 정할 때 본 선택 값. 선택이 바뀐 것을 알아채는 데 씀
  readonly selectedValue: Value | null;
};

export interface ListboxColumnProps<Value extends string>
  extends Omit<HTMLAttributes<HTMLUListElement>, 'children' | 'onChange' | 'onSelect'> {
  readonly 'aria-label': string;
  readonly hasAutofocus: boolean;
  readonly onChoose: (value: Value) => void;
  // Constraint: 오름차순이고 값이 고정 폭 문자열이어야 함. 문자열 비교를 순서 비교로 씀
  readonly options: readonly ListboxOption<Value>[];
  readonly part: Extract<PartName, 'time-list' | 'time-column'>;
  readonly ref?: Ref<HTMLUListElement> | undefined;
  readonly selectedValue: Value | null;
}

// Goal: 시간 목록과 시·분 두 칸이 같은 listbox 동작(roving tabindex, 비활성 건너뛰기, 가운데 스크롤)을 쓰게 함
// Constraint: onChoose는 활성 옵션을 클릭·Enter·Space로 골랐을 때만 부름. 같은 옵션을 다시 골라도 부름
export const ListboxColumn = <Value extends string>({
  hasAutofocus,
  onChoose,
  options,
  part,
  selectedValue,
  ...domProps
}: ListboxColumnProps<Value>): ReactElement => {
  const disabledOptions = useMemo(() => options.map((option) => option.isDisabled), [options]);
  const values = useMemo(() => options.map((option) => option.value), [options]);
  const [storedRoving, setRoving] = useState<RovingState<Value>>({ focusedValue: selectedValue, selectedValue });
  // Constraint: 선택이 바뀌면(고르기, 부모의 새 값) 탭 정지점도 새 선택으로 옮김. 렌더 중 상태 갱신이라 StrictMode 이중 렌더에서도 같은 결과
  const roving =
    storedRoving.selectedValue === selectedValue ? storedRoving : { focusedValue: selectedValue, selectedValue };
  if (roving !== storedRoving) setRoving(roving);
  // Constraint: 간격에 맞지 않는 값(09:37)이나 목록에 없는 값이면 그 앞의 가장 가까운 옵션에서 시작함
  const defaultIndex = Math.max(FIRST_INDEX, disabledOptions.indexOf(false));
  const tabStopIndex = indexAtOrBefore(values, roving.focusedValue) ?? defaultIndex;
  const selectedIndex = indexAtOrBefore(values, selectedValue) ?? defaultIndex;
  const listRef = useRef<HTMLUListElement | null>(null);

  // Goal: 열릴 때와 부모가 값을 바꿀 때 선택한 옵션이 목록 안에 보이게 함. 페이지는 움직이지 않도록 목록만 스크롤함. 그리기 전에 옮겨 맨 위가 잠깐 보이지 않게 함
  // Constraint: 이미 보이는 옵션(클릭으로 고른 옵션 등)이면 움직이지 않음
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.children[selectedIndex];
    if (list && option instanceof HTMLElement && !isFullyVisibleInList(list, option))
      scrollToCenterOfList(list, option);
  }, [selectedIndex]);

  const choose = (index: number): void => {
    const option = options[index];
    if (option === undefined || option.isDisabled) return;
    // Constraint: macOS Safari·Firefox는 클릭으로 포커스를 옮기지 않으므로 탭 정지점을 직접 옮김
    setRoving({ focusedValue: option.value, selectedValue });
    onChoose(option.value);
  };

  const moveFocus = (event: KeyboardEvent<HTMLUListElement>): void => {
    const { key } = event;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(tabStopIndex);
      return;
    }
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'End' && key !== 'Home') return;
    const nextIndex = nextIndexForKey({ disabledOptions, focusedIndex: tabStopIndex, key });
    const nextValue = values[nextIndex];
    const nextOption = event.currentTarget.children[nextIndex];
    if (nextValue === undefined || !(nextOption instanceof HTMLElement)) {
      if (disabledOptions.includes(true)) event.preventDefault();
      return;
    }
    event.preventDefault();
    // Constraint: 문서에 포커스가 없으면 focus 이벤트가 오지 않으므로 옵션의 onFocus에만 기대지 않고 탭 정지점을 직접 옮김
    setRoving({ focusedValue: nextValue, selectedValue });
    nextOption.focus();
  };

  // Constraint: Biome의 role 규칙은 JSX에 직접 쓴 role만 보므로 달력 격자처럼 role을 속성 객체로 펼침 (preflight 2.7)
  const listProps = mergeProps(
    { role: 'listbox', ref: listRef, onKeyDown: moveFocus, ...partAttributes(part) },
    domProps,
  );

  return (
    <ul {...listProps}>
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isTabStop = index === tabStopIndex;
        const optionProps = {
          role: 'option',
          'aria-disabled': option.isDisabled || undefined,
          'aria-selected': isSelected,
          tabIndex: isTabStop ? 0 : -1,
          // Goal: Popover·Sheet가 열릴 때 선택한 옵션이나 첫 활성 옵션에 포커스가 가게 함 (스펙 10.4, preflight 3.3)
          ...(isTabStop && hasAutofocus ? { [AUTOFOCUS_ATTRIBUTE]: '' } : {}),
          onClick: () => choose(index),
          onFocus: () => setRoving({ focusedValue: option.value, selectedValue }),
          ...partAttributes('time-option', { disabled: option.isDisabled, selected: isSelected, focused: isTabStop }),
        };
        return (
          <li key={option.value} {...optionProps}>
            {option.label}
          </li>
        );
      })}
    </ul>
  );
};

const indexAtOrBefore = <Value extends string>(values: readonly Value[], value: Value | null): number | null => {
  if (value === null) return null;
  const index = values.reduce(
    (found, candidate, candidateIndex) => (candidate <= value ? candidateIndex : found),
    MISSING_INDEX,
  );
  return index === MISSING_INDEX ? null : index;
};

const isFullyVisibleInList = (list: HTMLElement, option: HTMLElement): boolean => {
  const listRect = list.getBoundingClientRect();
  const optionRect = option.getBoundingClientRect();
  return (
    optionRect.top >= listRect.top + list.clientTop &&
    optionRect.bottom <= listRect.top + list.clientTop + list.clientHeight
  );
};

const nextIndexForKey = ({ disabledOptions, focusedIndex, key }: KeyMoveInput): number => {
  if (key === 'Home') return disabledOptions.indexOf(false);
  if (key === 'End') return disabledOptions.lastIndexOf(false);
  const offset = key === 'ArrowDown' ? 1 : -1;
  for (let index = focusedIndex + offset; index >= FIRST_INDEX && index < disabledOptions.length; index += offset) {
    if (!disabledOptions[index]) return index;
  }
  return MISSING_INDEX;
};

const scrollToCenterOfList = (list: HTMLElement, option: HTMLElement): void => {
  const listTop = list.getBoundingClientRect().top + list.clientTop;
  const optionRect = option.getBoundingClientRect();
  list.scrollBy({ top: optionRect.top - listTop - (list.clientHeight - optionRect.height) / 2 });
};

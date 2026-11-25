import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type Locator, userEvent } from 'vitest/browser';
import { type RenderResult, render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { settleEffects } from '../testing/settle-effects';
import { TimeColumns, type TimeColumnsRootProps } from './index';

const GROUP_LABEL = '시간 선택';
const HOUR_LABEL = '시';
const MINUTE_LABEL = '분';
// Goal: react 패키지 테스트에는 테마가 없으므로 칸 높이를 묶어야 칸 안 스크롤을 확인할 수 있음
const SHORT_COLUMNS_STYLE = '[data-lsp-part="time-column"] { max-block-size: 120px; overflow-y: auto; }';
const TAB_STOP_SELECTOR = '[role="option"][tabindex="0"]';
const VALID_DETAILS = { validity: { isValid: true, reasons: [] } };

const columns = (props: Partial<TimeColumnsRootProps>): ReactElement => (
  <TimeColumns.Root
    aria-label={GROUP_LABEL}
    hourLabel={HOUR_LABEL}
    minuteLabel={MINUTE_LABEL}
    minuteStep={15}
    {...props}
  />
);

const columnOf = (screen: RenderResult, label: string): Locator => screen.getByRole('listbox', { name: label });

const optionOf = (screen: RenderResult, label: string, name: string): Locator =>
  columnOf(screen, label).getByRole('option', { name, exact: true });

describe('TimeColumns', () => {
  describe('picking', () => {
    it('keeps the minute and reports no pick when an hour is picked', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await render(columns({ defaultValue: '09:30', onPick, onValueChange }));

      await optionOf(screen, HOUR_LABEL, '14').click();
      await settleEffects();

      expect(onValueChange.mock.calls).toEqual([['14:30', VALID_DETAILS]]);
      expect(onPick).not.toHaveBeenCalled();
      await expect.element(optionOf(screen, HOUR_LABEL, '14')).toHaveAttribute('aria-selected', 'true');
      await expect.element(optionOf(screen, MINUTE_LABEL, '30')).toHaveAttribute('aria-selected', 'true');
    });

    it('reports a pick for every minute pick, including the same minute', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await render(columns({ defaultValue: '09:30', onPick, onValueChange }));

      await optionOf(screen, MINUTE_LABEL, '45').click();
      await optionOf(screen, MINUTE_LABEL, '45').click();

      expect(onValueChange.mock.calls).toEqual([['09:45', VALID_DETAILS]]);
      expect(onPick.mock.calls).toEqual([['09:45'], ['09:45']]);
    });

    it('shows the parent value when a controlled change is rejected', async () => {
      const onValueChange = vi.fn();
      const screen = await render(columns({ value: '09:30', onValueChange }));

      await optionOf(screen, HOUR_LABEL, '14').click();
      await settleEffects();

      expect(onValueChange).toHaveBeenCalledWith('14:30', VALID_DETAILS);
      await expect.element(optionOf(screen, HOUR_LABEL, '09')).toHaveAttribute('aria-selected', 'true');
      await expect.element(optionOf(screen, HOUR_LABEL, '14')).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('bounds', () => {
    it('disables hours and minutes outside the bounds', async () => {
      const screen = await render(columns({ max: '17:15', min: '09:30', value: '09:30' }));

      await expect.element(optionOf(screen, HOUR_LABEL, '08')).toHaveAttribute('aria-disabled', 'true');
      await expect.element(optionOf(screen, HOUR_LABEL, '09')).not.toHaveAttribute('aria-disabled');
      await expect.element(optionOf(screen, MINUTE_LABEL, '15')).toHaveAttribute('aria-disabled', 'true');
      await expect.element(optionOf(screen, MINUTE_LABEL, '30')).not.toHaveAttribute('aria-disabled');
    });

    it('reflects new bounds when min changes', async () => {
      const screen = await render(columns({ max: '17:15', min: '09:30', value: '09:30' }));
      await expect.element(optionOf(screen, HOUR_LABEL, '09')).not.toHaveAttribute('aria-disabled');

      await screen.rerender(columns({ max: '17:15', min: '10:00', value: '09:30' }));

      const hour = optionOf(screen, HOUR_LABEL, '09');
      await expect.element(hour).toHaveAttribute('aria-disabled', 'true');
      await expect.element(hour).toHaveAttribute('aria-selected', 'true');
      await expect.element(optionOf(screen, MINUTE_LABEL, '30')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('off-step value', () => {
    it('selects no minute and starts from the option before', async () => {
      const screen = await render(columns({ minuteStep: 5, value: '09:07' }));
      const minutes = columnOf(screen, MINUTE_LABEL).element();

      await expect.element(optionOf(screen, HOUR_LABEL, '09')).toHaveAttribute('aria-selected', 'true');
      expect(minutes.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(minutes.querySelector(TAB_STOP_SELECTOR)?.textContent).toBe('05');
    });
  });

  describe('keyboard', () => {
    it('moves between columns with left and right arrows', async () => {
      const screen = await render(columns({ defaultValue: '09:30' }));
      await focusDirectly(optionOf(screen, HOUR_LABEL, '09'));

      await userEvent.keyboard('{ArrowRight}');
      await expect.element(optionOf(screen, MINUTE_LABEL, '30')).toHaveFocus();
      await userEvent.keyboard('{ArrowLeft}');
      await expect.element(optionOf(screen, HOUR_LABEL, '09')).toHaveFocus();
    });

    it('picks with Enter and skips disabled options', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await render(
        columns({ defaultValue: '09:30', max: '17:15', min: '09:30', onPick, onValueChange }),
      );

      await focusDirectly(optionOf(screen, MINUTE_LABEL, '30'));
      await userEvent.keyboard('{ArrowUp}');
      await expect.element(optionOf(screen, MINUTE_LABEL, '30')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(onPick.mock.calls).toEqual([['09:30']]);

      await focusDirectly(optionOf(screen, HOUR_LABEL, '09'));
      await userEvent.keyboard('{ArrowUp}');
      await expect.element(optionOf(screen, HOUR_LABEL, '09')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}{Enter}');

      expect(onValueChange.mock.calls).toEqual([['10:30', VALID_DETAILS]]);
      expect(onPick.mock.calls).toEqual([['09:30']]);
    });

    it('puts autofocus only on the hour column', async () => {
      const screen = await render(columns({ defaultValue: '09:30' }));
      await expect.element(columnOf(screen, HOUR_LABEL)).toBeVisible();

      const autofocusTexts = Array.from(
        screen.container.querySelectorAll('[data-autofocus]'),
        (element) => element.textContent,
      );
      expect(autofocusTexts).toEqual(['09']);
    });
  });

  describe('scrolling', () => {
    it('scrolls each column to its selected option', async () => {
      const screen = await render(
        <>
          <style>{SHORT_COLUMNS_STYLE}</style>
          {columns({ minuteStep: 1, value: '23:59' })}
        </>,
      );

      await expect.poll(() => columnOf(screen, HOUR_LABEL).element().scrollTop).toBeGreaterThan(0);
      await expect.poll(() => columnOf(screen, MINUTE_LABEL).element().scrollTop).toBeGreaterThan(0);
    });

    it('follows a value changed by the parent', async () => {
      const screen = await render(columns({ value: '09:30' }));

      await screen.rerender(columns({ value: '18:45' }));

      await expect.element(optionOf(screen, HOUR_LABEL, '18')).toHaveAttribute('aria-selected', 'true');
      await expect.element(optionOf(screen, MINUTE_LABEL, '45')).toHaveAttribute('aria-selected', 'true');
      await expect.element(optionOf(screen, HOUR_LABEL, '18')).toHaveAttribute('tabindex', '0');
    });
  });

  it('has no axe violations', async () => {
    const screen = await render(columns({ defaultValue: '09:30' }));
    await expect.element(screen.getByRole('group', { name: GROUP_LABEL })).toBeVisible();

    await expectNoAxeViolations(screen.container);
  });
});

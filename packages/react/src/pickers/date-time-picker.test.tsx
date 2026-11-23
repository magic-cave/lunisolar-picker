import '@lunisolar-picker/theme/mono.css';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { focusDirectly } from '../testing/focus-directly';
import { focusOnce } from '../testing/focus-once';
import { formElementOf } from '../testing/form-element';
import { dayLabel, KoreanProvider } from '../testing/korean-fixture';
import { hiddenInputNamed } from '../testing/picker-fixture';
import { settleEffects } from '../testing/settle-effects';
import { DateTimePicker, type DateTimePickerProps } from './index';

const TODAY = '2026-11-24';
const TOMORROW = '2026-11-25';
const YESTERDAY = '2026-11-23';
const VALUE = '2026-11-24T14:30';
const VALID = { validity: { isValid: true, reasons: [] } };
const BEFORE_MIN = { validity: { isValid: false, reasons: ['before-min'] } };
const FIELD_NAME = 'due';

const Fixture = (props: DateTimePickerProps): ReactElement => (
  <KoreanProvider>
    <DateTimePicker today={TODAY} name={FIELD_NAME} presentation="popover" {...props} />
  </KoreanProvider>
);

const renderPicker = (props: DateTimePickerProps = {}) => render(<Fixture {...props} />);
type PickerScreen = Awaited<ReturnType<typeof renderPicker>>;

const triggerOf = (screen: PickerScreen) => screen.getByRole('button', { name: ko.labels.chooseDateTime });
const dayOf = (screen: PickerScreen, isoDate: string) => screen.getByRole('button', { name: dayLabel(isoDate) });
const timeOf = (screen: PickerScreen, time: string) => screen.getByRole('option', { name: time });
const segmentOf = (screen: PickerScreen, part: 'day' | 'hour' | 'year') =>
  screen.getByRole('spinbutton', { name: ko.labels[part] });

const typeDateTime = async (screen: PickerScreen, digits: string): Promise<void> => {
  await focusOnce(segmentOf(screen, 'year'));
  await userEvent.keyboard(digits);
};

describe('DateTimePicker', () => {
  describe('immediate mode', () => {
    it('publishes a date and time typed in one field', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker({ onValueChange });

      await typeDateTime(screen, '202611241430');

      await expect.poll(() => onValueChange.mock.calls).toEqual([[VALUE, VALID]]);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe(VALUE);
    });

    it('opens a named dialog with calendar focus and a tabbable time list', async () => {
      const screen = await renderPicker();
      const trigger = triggerOf(screen);
      await focusOnce(trigger);

      await trigger.click();

      await expect.element(screen.getByRole('dialog', { name: ko.labels.chooseDateTime })).toBeVisible();
      await expect.element(screen.getByRole('grid')).toBeVisible();
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await expect.element(dayOf(screen, TODAY)).toHaveFocus();
      await userEvent.tab();
      await expect.element(timeOf(screen, '00:00')).toHaveFocus();
    });

    it('keeps the calendar open for a date pick and closes after picking the time', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker({ onValueChange, onPick });

      await triggerOf(screen).click();
      await dayOf(screen, TOMORROW).click();

      await expect.element(segmentOf(screen, 'day')).toHaveTextContent('25');
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onPick).not.toHaveBeenCalled();

      await timeOf(screen, '14:30').click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-11-25T14:30', VALID]]);
      expect(onPick.mock.calls).toEqual([['2026-11-25T14:30']]);
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    });

    it('accepts the time first and waits for the date to complete the value', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker({ onValueChange, onPick });

      await triggerOf(screen).click();
      await timeOf(screen, '14:30').click();

      await expect.element(screen.getByRole('dialog')).toBeVisible();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();

      await dayOf(screen, TODAY).click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([[VALUE, VALID]]);
      expect(onPick.mock.calls).toEqual([[VALUE]]);
      await expect.element(screen.getByRole('dialog')).toBeVisible();
    });

    it('updates the date alone and reports a same-time re-pick without another change', async () => {
      const onValueChange = vi.fn();
      const onPick = vi.fn();
      const screen = await renderPicker({ defaultValue: VALUE, onValueChange, onPick });

      await triggerOf(screen).click();
      await dayOf(screen, TOMORROW).click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-11-25T14:30', VALID]]);
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      await timeOf(screen, '14:30').click();

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onPick.mock.calls).toEqual([['2026-11-25T14:30'], ['2026-11-25T14:30']]);
    });

    it.each(['onPick', 'onOpenChange'] as const)(
      'reports the value before %s can unmount the picker',
      async (callback) => {
        const onValueChange = vi.fn();
        const App = (): ReactElement | null => {
          const [isVisible, setVisible] = useState(true);
          if (!isVisible) return null;
          return (
            <Fixture
              defaultOpen
              defaultValue="2026-11-24T15:00"
              onValueChange={onValueChange}
              onPick={callback === 'onPick' ? () => setVisible(false) : undefined}
              onOpenChange={callback === 'onOpenChange' ? (open) => setVisible(open) : undefined}
            />
          );
        };
        const screen = await render(<App />);

        await timeOf(screen, '14:30').click();

        await expect.element(triggerOf(screen)).not.toBeInTheDocument();
        expect(onValueChange.mock.calls).toEqual([[VALUE, VALID]]);
      },
    );

    it('uses half-hour options and leaves the value in place after Escape', async () => {
      const screen = await renderPicker({ defaultValue: '2026-11-24T14:37' });
      await triggerOf(screen).click();

      await expect.element(timeOf(screen, '14:00')).toBeInTheDocument();
      await expect.element(timeOf(screen, '14:30')).toHaveAttribute('tabindex', '0');
      await expect.element(timeOf(screen, '14:15')).not.toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('2026-11-24T14:37');
    });
  });

  describe('bounds', () => {
    it('limits the calendar and disables times only on the minimum date', async () => {
      const screen = await renderPicker({ min: VALUE, defaultOpen: true });

      await expect.element(dayOf(screen, YESTERDAY)).toHaveAttribute('aria-disabled', 'true');
      await dayOf(screen, TODAY).click();

      await expect.element(timeOf(screen, '14:00')).toHaveAttribute('aria-disabled', 'true');
      await expect.element(timeOf(screen, '14:30')).not.toHaveAttribute('aria-disabled');

      await dayOf(screen, TOMORROW).click();
      await expect.element(timeOf(screen, '14:00')).not.toHaveAttribute('aria-disabled');
    });

    it('preserves a selected time that becomes invalid after picking a different date', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker({
        min: VALUE,
        defaultValue: '2026-11-25T09:00',
        defaultOpen: true,
        onValueChange,
      });

      await dayOf(screen, TODAY).click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-11-24T09:00', BEFORE_MIN]]);
      expect(screen.container.querySelector('[data-lsp-part="date-time-picker"]')).toHaveAttribute('data-invalid');
      await expect.element(timeOf(screen, '09:00')).toHaveAttribute('data-selected');
      await expect.element(timeOf(screen, '09:00')).toHaveAttribute('data-disabled');
    });

    it('revalidates the existing value when the minimum moves without reporting a change', async () => {
      const onValueChange = vi.fn();
      const value = '2026-11-24T15:00';
      const screen = await renderPicker({ value, min: VALUE, onValueChange });

      await screen.rerender(<Fixture value={value} min="2026-11-24T15:30" onValueChange={onValueChange} />);

      expect(screen.container.querySelector('[data-lsp-part="date-time-picker"]')).toHaveAttribute('data-invalid');
      expect(hiddenInputNamed(FIELD_NAME).value).toBe(value);
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keeps an all-disabled list still and accepts a valid off-step time typed into the field', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker({ min: '2026-11-24T23:45', onValueChange });

      await triggerOf(screen).click();
      await dayOf(screen, TODAY).click();

      const listbox = screen.getByRole('listbox');
      expect(listbox.element().querySelectorAll('[aria-disabled="true"]')).toHaveLength(48);
      const first = timeOf(screen, '00:00');
      await focusDirectly(first);
      await userEvent.keyboard('{ArrowDown}{End}');
      await expect.element(first).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      await focusOnce(segmentOf(screen, 'hour'));
      await userEvent.keyboard('2350');

      await expect.poll(() => onValueChange.mock.calls).toEqual([['2026-11-24T23:50', VALID]]);
    });

    it('limits late times and later days on the maximum boundary', async () => {
      const screen = await renderPicker({ max: VALUE, defaultOpen: true });

      await expect.element(dayOf(screen, TOMORROW)).toHaveAttribute('aria-disabled', 'true');
      await dayOf(screen, TODAY).click();

      await expect.element(timeOf(screen, '14:30')).not.toHaveAttribute('data-disabled');
      await expect.element(timeOf(screen, '15:00')).toHaveAttribute('data-disabled');
    });

    it('renders reversed same-day bounds with no selectable time', async () => {
      const screen = await renderPicker({ min: VALUE, max: '2026-11-24T14:00', defaultOpen: true });

      await dayOf(screen, TODAY).click();

      expect(screen.getByRole('listbox').element().querySelectorAll('[aria-disabled="true"]')).toHaveLength(48);
    });
  });

  describe('controlled values', () => {
    it('reports a timestamp with seconds once and shows empty fields', async () => {
      const onInvalidValue = vi.fn();
      const value = '2026-11-24T05:30:00.000Z';
      const screen = await renderPicker({ value, onInvalidValue });

      await expect.element(segmentOf(screen, 'year')).toHaveAttribute('data-placeholder');
      await expect.element(segmentOf(screen, 'hour')).toHaveAttribute('data-placeholder');
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
      await screen.rerender(<Fixture value={value} onInvalidValue={onInvalidValue} />);
      await settleEffects();
      expect(onInvalidValue.mock.calls).toEqual([[value, 'invalid-time']]);
    });

    it('clears the field and both selections on an external null while open', async () => {
      const screen = await renderPicker({ value: VALUE, defaultOpen: true });
      await expect.element(timeOf(screen, '14:30')).toHaveAttribute('data-selected');

      await screen.rerender(<Fixture value={null} defaultOpen />);

      await expect.element(segmentOf(screen, 'year')).toHaveAttribute('data-placeholder');
      await expect.element(segmentOf(screen, 'hour')).toHaveAttribute('data-placeholder');
      await expect.element(timeOf(screen, '14:30')).not.toHaveAttribute('data-selected');
      await expect
        .element(screen.getByRole('gridcell', { name: dayLabel(TODAY) }))
        .toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('controls and forms', () => {
    it('renders both buttons inside the field and restores field focus when cleared', async () => {
      const onValueChange = vi.fn();
      const screen = await renderPicker({ defaultValue: VALUE, onValueChange });
      const clear = screen.getByRole('button', { name: ko.labels.clear });
      const field = screen.container.querySelector('[data-lsp-part="date-time-field"]');
      expect(field?.contains(clear.element())).toBe(true);
      expect(field?.contains(triggerOf(screen).element())).toBe(true);
      await focusOnce(clear);

      await clear.click();

      await expect.poll(() => onValueChange.mock.calls).toEqual([[null, VALID]]);
      await expect.element(segmentOf(screen, 'year')).toHaveFocus();
      expect(hiddenInputNamed(FIELD_NAME).value).toBe('');
    });

    it.each([{ isClearable: false }, { disabled: true }, { readOnly: true }])('hides clear with %j', async (props) => {
      const screen = await renderPicker({ defaultValue: VALUE, ...props });

      await expect.element(screen.getByRole('button', { name: ko.labels.clear })).not.toBeInTheDocument();
    });

    it('submits one value and restores the uncontrolled default on reset', async () => {
      const onValueChange = vi.fn();
      const screen = await render(
        <form aria-label="Deadline">
          <Fixture defaultValue={VALUE} onValueChange={onValueChange} />
        </form>,
      );
      const form = formElementOf(screen.getByRole('form'));

      await typeDateTime(screen, '202611251530');
      await expect.poll(() => new FormData(form).getAll(FIELD_NAME)).toEqual(['2026-11-25T15:30']);
      onValueChange.mockClear();

      form.reset();

      await expect.poll(() => new FormData(form).getAll(FIELD_NAME)).toEqual([VALUE]);
      await expect.element(segmentOf(screen, 'day')).toHaveTextContent('24');
      expect(onValueChange.mock.calls).toEqual([[VALUE, VALID]]);
    });

    it('blocks required submission on a partial date and sends validation focus to the first segment', async () => {
      const onSubmit = vi.fn();
      const screen = await render(
        <form aria-label="Deadline" onSubmit={onSubmit}>
          <Fixture required />
          <button type="submit">Save</button>
        </form>,
      );

      await typeDateTime(screen, '20261124');
      await screen.getByRole('button', { name: 'Save' }).click();
      const input = hiddenInputNamed(FIELD_NAME);
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(input.validity.valueMissing).toBe(true);
      await expect.element(segmentOf(screen, 'year')).toHaveFocus();
    });

    it('closes when disabled and removes the field from form data without clearing it', async () => {
      const onOpenChange = vi.fn();
      const Form = ({ disabled }: { readonly disabled: boolean }): ReactElement => (
        <form aria-label="Deadline">
          <Fixture defaultOpen defaultValue={VALUE} disabled={disabled} onOpenChange={onOpenChange} />
        </form>
      );
      const screen = await render(<Form disabled={false} />);
      await expect.element(screen.getByRole('dialog')).toBeVisible();

      await screen.rerender(<Form disabled />);

      await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      expect(new FormData(formElementOf(screen.getByRole('form'))).has(FIELD_NAME)).toBe(false);
      expect(hiddenInputNamed(FIELD_NAME).value).toBe(VALUE);
      await expect.element(triggerOf(screen)).toBeDisabled();
    });

    it('reports leaving the segments for the trigger even within the same visual box', async () => {
      const onBlur = vi.fn();
      const screen = await renderPicker({ onBlur });
      await focusOnce(screen.getByRole('spinbutton', { name: ko.labels.minute }));

      await focusDirectly(triggerOf(screen));

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('focuses the first segment through the public ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await renderPicker({ ref });

      ref.current?.focus();

      await expect.element(segmentOf(screen, 'year')).toHaveFocus();
    });

    it('has no axe violations in the closed or open view', async () => {
      const screen = await renderPicker({ defaultValue: VALUE, 'aria-label': ko.labels.chooseDateTime });
      await expectNoAxeViolations(document.body);

      await triggerOf(screen).click();

      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await expectNoAxeViolations(document.body);
    });
  });
});

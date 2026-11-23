import { parseDate, parseTime } from '@lunisolar-picker/calendar';
import { dangi } from '@lunisolar-picker/calendar/dangi';
import { VALID } from '@lunisolar-picker/core';
import { en } from '@lunisolar-picker/core/locales/en';
import { ko } from '@lunisolar-picker/core/locales/ko';
import { createRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { type Locator, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clickToFocus } from '../testing/click-to-focus';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { formElementOf } from '../testing/form-element';
import { settleEffects } from '../testing/settle-effects';
import * as DateTimeField from './parts';
import { type UseDateTimeFieldProps, useDateTimeField } from './use-date-time-field';

const DATE = '2026-11-24';
const VALUE = `${DATE}T14:30`;
const EMPTY = { validity: { isValid: false, reasons: ['incomplete'] } };
const BEFORE_MIN = { validity: { isValid: false, reasons: ['before-min'] } };
const AFTER_MAX = { validity: { isValid: false, reasons: ['after-max'] } };

const field = (props: UseDateTimeFieldProps = {}) => (
  <DateTimeField.Root aria-label="Due" locale={ko} name="due" {...props} />
);

const dueValue = (container: ParentNode): string | undefined =>
  container.querySelector<HTMLInputElement>('input[name="due"]')?.value;

const segment = (
  screen: { readonly getByRole: (role: 'spinbutton', options: { readonly name: string }) => Locator },
  kind: 'year' | 'day' | 'hour' | 'minute',
): Locator => screen.getByRole('spinbutton', { name: ko.labels[kind] });

const dispatchPaste = (element: Element, text: string): void => {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  element.dispatchEvent(event);
};

type Change = NonNullable<UseDateTimeFieldProps['onValueChange']>;

const EchoingParent = ({ onValueChange }: { readonly onValueChange: Change }) => {
  const [value, setValue] = useState<string | null>(VALUE);
  return field({
    value,
    onValueChange: (next, details) => {
      setValue(next);
      onValueChange(next, details);
    },
  });
};

const ExternalApiFixture = ({ onValueChange }: { readonly onValueChange: Change }) => {
  const api = useDateTimeField({ name: 'due', onValueChange, locale: ko });
  const date = parseDate(DATE);
  const time = parseTime('14:30');
  if (!date.isOk || !time.isOk) throw new Error('Invalid date/time fixture');
  const view = (
    <DateTimeField.View api={api} aria-label="Due">
      <DateTimeField.Date />
      <DateTimeField.Time />
      <DateTimeField.HiddenInput />
    </DateTimeField.View>
  );
  return (
    <>
      {view}
      <button type="button" onClick={() => api.setDatePart(date.value.value)}>
        Set date
      </button>
      <button type="button" onClick={() => api.setTimePart(time.value.value)}>
        Set time
      </button>
      <button type="button" onClick={() => api.setParts(date.value.value, time.value.value)}>
        Set both
      </button>
      <button type="button" onClick={api.clear}>
        Clear
      </button>
    </>
  );
};

describe('DateTimeField', () => {
  describe('combined value', () => {
    it('keeps a date-only draft and emits once after the final minute digit', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ onValueChange }));
      await clickToFocus(segment(screen, 'year'));
      await userEvent.keyboard('20261124');

      await expect.element(segment(screen, 'hour')).toHaveFocus();
      expect(dueValue(screen.container)).toBe('');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();

      await userEvent.keyboard('143');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      await userEvent.keyboard('0');
      await expect.poll(() => onValueChange.mock.calls).toEqual([[VALUE, { validity: VALID }]]);
      expect(dueValue(screen.container)).toBe(VALUE);
    });

    it('emits once when the date is completed after the time', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ onValueChange }));
      await clickToFocus(segment(screen, 'hour'));
      await userEvent.keyboard('930');
      expect(dueValue(screen.container)).toBe('');
      await clickToFocus(segment(screen, 'year'));
      await userEvent.keyboard('20261124');
      await expect.poll(() => onValueChange.mock.calls).toEqual([[`${DATE}T09:30`, { validity: VALID }]]);
    });

    it('keeps the date after clearing the hour and receiving a controlled null echo', async () => {
      const onValueChange = vi.fn();
      const screen = await render(<EchoingParent onValueChange={onValueChange} />);
      await clickToFocus(segment(screen, 'hour'));
      await userEvent.keyboard('{Backspace}');
      await expect.poll(() => onValueChange.mock.calls).toEqual([[null, EMPTY]]);
      await settleEffects();
      await expect.element(segment(screen, 'day')).toHaveTextContent('24');
      expect(dueValue(screen.container)).toBe('');
    });

    it('synchronizes both parts for a different value and an external null reset', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ value: VALUE, onValueChange }));
      await screen.rerender(field({ value: '2027-12-31T08:04', onValueChange }));
      await expect.element(segment(screen, 'year')).toHaveTextContent('2027');
      await expect.element(segment(screen, 'hour')).toHaveTextContent('08');

      await screen.rerender(field({ value: null, onValueChange }));
      await expect.element(segment(screen, 'year')).toHaveAttribute('data-placeholder');
      await expect.element(segment(screen, 'hour')).toHaveAttribute('data-placeholder');
      expect(dueValue(screen.container)).toBe('');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('synchronizes both controlled parts silently when the old calendar is removed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ calendars: [dangi], value: `${VALUE}[u-ca=dangi]`, onValueChange }));
      const next = '2027-12-31T08:04';
      await screen.rerender(field({ value: next, onValueChange }));

      await expect.poll(() => dueValue(screen.container)).toBe(next);
      await expect.element(segment(screen, 'year')).toHaveTextContent('2027');
      await expect.element(segment(screen, 'hour')).toHaveTextContent('08');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it.each([VALUE, null])(
      'restores unchanged controlled value %j when the draft calendar is removed',
      async (value) => {
        const onValueChange = vi.fn();
        const screen = await render(field({ calendars: [dangi], value, onValueChange }));
        const draft = '2026-11-25T15:55[u-ca=dangi]';
        dispatchPaste(segment(screen, 'year').element(), draft);
        await expect.poll(() => onValueChange.mock.calls).toEqual([[draft, { validity: VALID }]]);

        await screen.rerender(field({ value, onValueChange }));
        await expect.poll(() => dueValue(screen.container)).toBe(value ?? '');
        await expect.element(segment(screen, 'hour')).toHaveTextContent(value === null ? 'HH' : '14');
        await settleEffects();
        expect(onValueChange.mock.calls).toEqual([[draft, { validity: VALID }]]);
      },
    );

    it('preserves a pending time draft when an unrelated calendar is removed', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ calendars: [dangi], value: VALUE, onValueChange }));
      const minute = segment(screen, 'minute');
      await clickToFocus(minute);
      await userEvent.keyboard('3');
      await screen.rerender(field({ value: VALUE, onValueChange }));

      await expect.element(minute).toHaveTextContent('3');
      expect(dueValue(screen.container)).toBe(VALUE);
      await userEvent.keyboard('5');
      await expect.poll(() => onValueChange.mock.calls).toEqual([[`${DATE}T14:35`, { validity: VALID }]]);
    });

    it('synchronizes an external value that matches the pending minute', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ value: VALUE, onValueChange }));
      const minute = segment(screen, 'minute');
      await clickToFocus(minute);
      await userEvent.keyboard('3');
      expect(dueValue(screen.container)).toBe(VALUE);

      const selected = `${DATE}T14:03`;
      await screen.rerender(field({ value: selected, onValueChange }));
      await expect.poll(() => dueValue(screen.container)).toBe(selected);
      await expect.element(minute).toHaveTextContent('03');
      await expect.element(minute).toHaveFocus();
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('keeps the last completed value while replacing the first digit of the minute', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ defaultValue: VALUE, onValueChange }));
      await clickToFocus(segment(screen, 'minute'));
      await userEvent.keyboard('4');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(dueValue(screen.container)).toBe(VALUE);

      await userEvent.keyboard('0');
      await expect.poll(() => onValueChange.mock.calls).toEqual([[`${DATE}T14:40`, { validity: VALID }]]);
    });

    it('starts empty and reports an invalid controlled time once', async () => {
      const onInvalidValue = vi.fn();
      const value = '2026-11-24T05:30:00.000Z';
      const screen = await render(field({ value, defaultValue: VALUE, onInvalidValue }));
      await expect.element(segment(screen, 'year')).toHaveAttribute('data-placeholder');
      await expect.element(segment(screen, 'hour')).toHaveAttribute('data-placeholder');
      await screen.rerender(field({ value, onInvalidValue }));
      await expect.poll(() => onInvalidValue.mock.calls).toEqual([[value, 'invalid-time']]);
    });
  });

  describe('focus', () => {
    it('moves across the boundary while keeping outer arrow keys in the field', async () => {
      const screen = await render(field());
      await clickToFocus(segment(screen, 'year'));
      await userEvent.keyboard('{ArrowLeft}');
      await expect.element(segment(screen, 'year')).toHaveFocus();

      await clickToFocus(segment(screen, 'day'));
      await userEvent.keyboard('{ArrowRight}');
      await expect.element(segment(screen, 'hour')).toHaveFocus();
      await userEvent.keyboard('{ArrowLeft}');
      await expect.element(segment(screen, 'day')).toHaveFocus();

      await clickToFocus(segment(screen, 'minute'));
      await userEvent.keyboard('{ArrowRight}');
      await expect.element(segment(screen, 'minute')).toHaveFocus();
    });

    it('follows the date segment order and writing direction', async () => {
      const screen = await render(
        <div dir="rtl">
          <DateTimeField.Root aria-label="Due" locale={en} />
        </div>,
      );
      const year = screen.getByRole('spinbutton', { name: en.labels.year });
      const hour = screen.getByRole('spinbutton', { name: en.labels.hour });
      await clickToFocus(year);
      await userEvent.keyboard('{ArrowLeft}');
      await expect.element(hour).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      await expect.element(year).toHaveFocus();
    });

    it('blurs once on leaving the whole field and does not flag a date-only draft', async () => {
      const onBlur = vi.fn();
      const screen = await render(
        <>
          {field({ onBlur })}
          <button type="button">Next</button>
        </>,
      );
      await clickToFocus(segment(screen, 'year'));
      await userEvent.keyboard('20261124');
      await expect.element(segment(screen, 'hour')).toHaveFocus();
      expect(onBlur).not.toHaveBeenCalled();

      await screen.getByRole('button', { name: 'Next' }).click();
      expect(onBlur).toHaveBeenCalledTimes(1);
      await expect.element(screen.getByRole('group', { name: 'Due' })).not.toHaveAttribute('data-invalid');
    });

    it('does not report focus changes within a portal after the field loses focus', async () => {
      const onBlur = vi.fn();
      const screen = await render(
        <DateTimeField.Root aria-label="Due" locale={ko} onBlur={onBlur}>
          <DateTimeField.Date />
          <DateTimeField.Time />
          {createPortal(
            <>
              <button type="button">First portal control</button>
              <button type="button">Second portal control</button>
            </>,
            document.body,
          )}
        </DateTimeField.Root>,
      );
      await clickToFocus(segment(screen, 'year'));

      await page.getByRole('button', { name: 'First portal control' }).click();
      expect(onBlur).toHaveBeenCalledTimes(1);
      await page.getByRole('button', { name: 'Second portal control' }).click();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('focuses the first date segment from the public ref', async () => {
      const ref = createRef<{ focus(): void }>();
      const screen = await render(<DateTimeField.Root aria-label="Due" locale={ko} ref={ref} />);
      ref.current?.focus();
      await expect.element(segment(screen, 'year')).toHaveFocus();
    });
  });

  describe('paste', () => {
    it.each([VALUE, `${DATE} 14:30`])('fills both parts from %s pasted into a date segment', async (text) => {
      const onValueChange = vi.fn();
      const screen = await render(field({ onValueChange }));
      dispatchPaste(segment(screen, 'year').element(), text);
      await expect.poll(() => onValueChange.mock.calls).toEqual([[VALUE, { validity: VALID }]]);
      expect(dueValue(screen.container)).toBe(VALUE);
    });

    it('leaves the time empty when the pasted content is a plain date', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ onValueChange }));
      dispatchPaste(segment(screen, 'year').element(), DATE);
      await expect.element(segment(screen, 'day')).toHaveTextContent('24');
      await expect.element(segment(screen, 'hour')).toHaveAttribute('data-placeholder');
      await settleEffects();
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('date-time bounds', () => {
    it.each([
      ['202611241400', `${DATE}T14:00`, BEFORE_MIN],
      ['202611250900', '2026-11-25T09:00', { validity: VALID }],
      ['202611231500', '2026-11-23T15:00', BEFORE_MIN],
    ])('validates both parts of %s and retains the submitted value', async (digits, expectedValue, details) => {
      const onValueChange = vi.fn();
      const screen = await render(field({ min: VALUE, onValueChange }));
      await clickToFocus(segment(screen, 'year'));
      await userEvent.keyboard(digits);
      await expect.poll(() => onValueChange.mock.calls).toEqual([[expectedValue, details]]);
      expect(dueValue(screen.container)).toBe(expectedValue);
      expect(screen.getByRole('group', { name: 'Due' }).element().hasAttribute('data-invalid')).toBe(
        !details.validity.isValid,
      );
    });

    it('includes midnight for a date-only minimum and validates a later maximum by time', async () => {
      const onValueChange = vi.fn();
      const screen = await render(field({ min: DATE, max: VALUE, onValueChange }));
      dispatchPaste(segment(screen, 'year').element(), `${DATE}T00:00`);
      await expect.poll(() => onValueChange.mock.calls).toEqual([[`${DATE}T00:00`, { validity: VALID }]]);
      dispatchPaste(segment(screen, 'year').element(), `${DATE}T14:31`);
      await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([`${DATE}T14:31`, AFTER_MAX]);
    });
  });

  it('emits only complete or cleared values from the public setters and composites the hook with View', async () => {
    const onValueChange = vi.fn();
    const screen = await render(<ExternalApiFixture onValueChange={onValueChange} />);
    await screen.getByRole('button', { name: 'Set date' }).click();
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: 'Set time' }).click();
    await expect.poll(() => onValueChange.mock.calls).toEqual([[VALUE, { validity: VALID }]]);
    await screen.getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => onValueChange.mock.calls.at(-1)).toEqual([null, { validity: VALID }]);
    await screen.getByRole('button', { name: 'Set both' }).click();
    await expect
      .poll(() => onValueChange.mock.calls)
      .toEqual([
        [VALUE, { validity: VALID }],
        [null, { validity: VALID }],
        [VALUE, { validity: VALID }],
      ]);
  });

  it('preserves lunar date input and moves the same day to Gregorian when the calendar is removed', async () => {
    const onValueChange = vi.fn();
    const screen = await render(field({ calendars: [dangi], defaultEntryCalendar: 'dangi', onValueChange }));
    await clickToFocus(segment(screen, 'year'));
    await userEvent.keyboard('202610161430');
    await expect.poll(() => onValueChange.mock.calls.at(-1)?.[0]).toBe(`${VALUE}[u-ca=dangi]`);

    await screen.rerender(field({ onValueChange }));
    await expect.poll(() => dueValue(screen.container)).toBe(VALUE);
  });

  it.each(['disabled', 'readOnly'] as const)('keeps its value when %s', async (status) => {
    const onValueChange = vi.fn();
    const screen = await render(field({ defaultValue: VALUE, [status]: true, onValueChange }));
    dispatchPaste(segment(screen, 'year').element(), '2026-11-25T15:30');
    dispatchPaste(segment(screen, 'hour').element(), '15:30');
    await settleEffects();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(dueValue(screen.container)).toBe(VALUE);
  });

  it('resets to an empty field when the mounted default refers to a removed calendar', async () => {
    const defaultValue = `${VALUE}[u-ca=dangi]`;
    const screen = await render(<form aria-label="Schedule">{field({ calendars: [dangi], defaultValue })}</form>);
    const form = formElementOf(screen.getByRole('form', { name: 'Schedule' }));
    await screen.rerender(<form aria-label="Schedule">{field({ defaultValue })}</form>);
    await expect.poll(() => new FormData(form).get('due')).toBe(VALUE);

    form.reset();
    await expect.poll(() => new FormData(form).get('due')).toBe('');
    await expect.element(segment(screen, 'year')).toHaveAttribute('data-placeholder');
    await expect.element(segment(screen, 'hour')).toHaveAttribute('data-placeholder');
  });

  it('restores the default on form reset when it matches the pending minute', async () => {
    const defaultValue = `${DATE}T14:03`;
    const screen = await render(<form aria-label="Schedule">{field({ defaultValue })}</form>);
    const form = formElementOf(screen.getByRole('form', { name: 'Schedule' }));
    dispatchPaste(segment(screen, 'year').element(), VALUE);
    await expect.poll(() => new FormData(form).get('due')).toBe(VALUE);
    const minute = segment(screen, 'minute');
    await clickToFocus(minute);
    await userEvent.keyboard('3');
    expect(new FormData(form).get('due')).toBe(VALUE);

    form.reset();
    await expect.poll(() => new FormData(form).get('due')).toBe(defaultValue);
    await expect.element(minute).toHaveTextContent('03');
  });

  it('uses one successful form control and restores its default on reset', async () => {
    const screen = await render(<form aria-label="Schedule">{field({ defaultValue: VALUE })}</form>);
    const form = formElementOf(screen.getByRole('form', { name: 'Schedule' }));
    dispatchPaste(segment(screen, 'year').element(), '2026-11-25T15:00');
    await expect.poll(() => new FormData(form).getAll('due')).toEqual(['2026-11-25T15:00']);
    form.reset();
    await expect.poll(() => new FormData(form).getAll('due')).toEqual([VALUE]);
    await expectNoAxeViolations(screen.container);
  });
});

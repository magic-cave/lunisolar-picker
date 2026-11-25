# @lunisolar-picker/theme

## 0.4.0

### Minor Changes

- a28c71d: Add `timeLayout="columns"` to `DateTimePicker` to pick the hour and the minute in separate columns, and the `TimeColumns.Root` part behind it. Picking an hour keeps the popover open, and picking a minute completes the time.

## 0.3.0

### Minor Changes

- 99c808c: Add `DateTimePicker`: one field and one popover for a date and a time, with values in `YYYY-MM-DDTHH:mm` (plus `[u-ca=dangi]` for lunar entries). Add the `DateTimeString` value type, the `DateTimeField` part and `useDateTimeField` hook, `min`/`max` on `TimePicker`, `TimeField` and `TimeList`, and the `--lsp-control-size` theme variable for input height. The `before-min` and `after-max` messages no longer mention dates, since they now also describe times.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 638ba08: Add `WheelTimePicker` and the `useWheelTime` hook: hour and minute drums that match `WheelDatePicker` in props, sheet draft behaviour and the Mono theme. Values are 24-hour `HH:mm` strings, `minuteStep` defaults to 1, and an empty picker rests at 12:00.

## 0.1.1

### Patch Changes

- f28139d: The Mono theme gives each wheel column a minimum width, so a standalone `Wheel` no longer collapses to nothing inside a container that shrinks to its content.

## 0.1.0

### Minor Changes

- 671e6e4: First public release. Date, date range, month, wheel and time pickers for React 19 with a headless core, the Mono theme, and optional Korean lunisolar (dangi) dates from KASI data.

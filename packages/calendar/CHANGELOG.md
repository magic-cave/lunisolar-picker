# @lunisolar-picker/calendar

## 0.3.0

### Minor Changes

- 99c808c: Add `DateTimePicker`: one field and one popover for a date and a time, with values in `YYYY-MM-DDTHH:mm` (plus `[u-ca=dangi]` for lunar entries). Add the `DateTimeString` value type, the `DateTimeField` part and `useDateTimeField` hook, `min`/`max` on `TimePicker`, `TimeField` and `TimeList`, and the `--lsp-control-size` theme variable for input height. The `before-min` and `after-max` messages no longer mention dates, since they now also describe times.

## 0.2.1

No changes in this release.

## 0.2.0

No changes in this release.

## 0.1.1

No changes in this release.

## 0.1.0

### Minor Changes

- 671e6e4: First public release. Date, date range, month, wheel and time pickers for React 19 with a headless core, the Mono theme, and optional Korean lunisolar (dangi) dates from KASI data.

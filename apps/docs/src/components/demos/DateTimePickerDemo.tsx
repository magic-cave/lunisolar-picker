import type { DateTimeString } from '@lunisolar-picker/calendar';
import { DateTimePicker, type TimeLayout } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const TODAY = '2026-11-24';

export const DateTimePickerDemo = () => {
  const [value, setValue] = useState<DateTimeString | null>(null);
  const [timeLayout, setTimeLayout] = useState<TimeLayout>('list');
  return (
    <DemoProvider>
      <label>
        <input
          type="checkbox"
          checked={timeLayout === 'columns'}
          onChange={(event) => setTimeLayout(event.target.checked ? 'columns' : 'list')}
        />{' '}
        Hour and minute columns
      </label>
      <DateTimePicker
        aria-label="Due date and time"
        today={TODAY}
        min={`${TODAY}T12:00`}
        timeLayout={timeLayout}
        value={value}
        onValueChange={(next) => setValue(next)}
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
};

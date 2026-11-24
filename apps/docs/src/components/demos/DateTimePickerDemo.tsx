import type { DateTimeString } from '@lunisolar-picker/calendar';
import { DateTimePicker } from '@lunisolar-picker/react/pickers';
import { useState } from 'react';
import { DemoProvider } from './DemoProvider';

const TODAY = '2026-11-24';

export const DateTimePickerDemo = () => {
  const [value, setValue] = useState<DateTimeString | null>(null);
  return (
    <DemoProvider>
      <DateTimePicker
        aria-label="Due date and time"
        today={TODAY}
        min={`${TODAY}T12:00`}
        value={value}
        onValueChange={(next) => setValue(next)}
      />
      <output>value: {JSON.stringify(value)}</output>
    </DemoProvider>
  );
};

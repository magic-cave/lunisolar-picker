import { LunisolarPickerError } from '@lunisolar-picker/calendar';
import { type Context, createContext, useContext } from 'react';
import type { DateTimeFieldApi } from './use-date-time-field';

export const DateTimeFieldContext: Context<DateTimeFieldApi | null> = createContext<DateTimeFieldApi | null>(null);

export const useDateTimeFieldContext = (): DateTimeFieldApi => {
  const field = useContext(DateTimeFieldContext);
  if (!field)
    throw new LunisolarPickerError(
      'DateTimeField parts must be rendered inside <DateTimeField.Root> or <DateTimeField.View>',
    );
  return field;
};

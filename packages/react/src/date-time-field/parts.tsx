import {
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useImperativeHandle,
} from 'react';
import { partAttributes } from '../contract/data-attributes';
import { DateFieldContext } from '../date-field/date-field-context';
import { LeapMonthToggle, Segment, Separator } from '../date-field/parts';
import { mergeProps } from '../utilities/merge-props';
import { type RenderProp, renderElement } from '../utilities/render-element';
import { HiddenInput as HiddenInputElement, type HiddenInputProps } from '../value/hidden-input';
import { DateTimeFieldContext, useDateTimeFieldContext } from './date-time-field-context';
import { type DateTimeFieldApi, fieldParts, type UseDateTimeFieldProps, useDateTimeField } from './use-date-time-field';

const TIME_SEPARATOR = ':';

export interface DateTimeFieldRenderState {
  readonly isDisabled: boolean;
  readonly isInvalid: boolean;
}

type FieldViewProps = {
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-label'?: string | undefined;
  readonly 'aria-labelledby'?: string | undefined;
  readonly children?: ReactNode;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly ref?: Ref<{ focus(): void }> | undefined;
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, DateTimeFieldRenderState> | undefined;
  readonly style?: CSSProperties | undefined;
};

export interface RootProps extends UseDateTimeFieldProps, FieldViewProps {}

export interface ViewProps extends FieldViewProps {
  readonly api: DateTimeFieldApi;
}

export const Root = (props: RootProps): ReactElement => {
  const api = useDateTimeField(props);
  return <View {...props} api={api} />;
};

export const View = (props: ViewProps): ReactElement => {
  const { api, children, ref, render } = props;
  useImperativeHandle(ref, () => ({ focus: api.focus }), [api.focus]);
  const appProps = {
    'aria-describedby': props['aria-describedby'],
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    className: props.className,
    id: props.id,
    style: props.style,
    children: children ?? (
      <>
        <DatePart />
        <Time />
        <HiddenInput />
      </>
    ),
  };
  return (
    <DateTimeFieldContext value={api}>
      {renderElement('div', render, mergeProps(api.getRootProps(), appProps), {
        isDisabled: api.isDisabled,
        isInvalid: api.isInvalid,
      })}
    </DateTimeFieldContext>
  );
};

const DatePart = (): ReactElement => {
  const { date } = useDateTimeFieldContext()[fieldParts];
  const { role: _role, ...props } = date.getRootProps();
  return (
    <DateFieldContext value={date}>
      <div {...props}>
        {date.state.segments.map((segment, index) => (
          <Fragment key={segment.kind}>
            {index > 0 && <Separator />}
            <Segment index={index} />
          </Fragment>
        ))}
        <LeapMonthToggle />
      </div>
    </DateFieldContext>
  );
};

export { DatePart as Date };

export const Time = (): ReactElement => {
  const { time, timeSegments } = useDateTimeFieldContext()[fieldParts];
  return (
    <div ref={time.rootRef} {...partAttributes('time-field')}>
      {timeSegments.map((segment, index) => (
        <Fragment key={segment.kind}>
          {index > 0 && (
            <span aria-hidden {...partAttributes('time-field-separator')}>
              {TIME_SEPARATOR}
            </span>
          )}
          <span {...time.getSegmentProps(index)} />
        </Fragment>
      ))}
    </div>
  );
};

export const HiddenInput = (props: Partial<HiddenInputProps>): ReactElement | null => {
  const field = useDateTimeFieldContext();
  return <HiddenInputElement {...field.getHiddenInputProps()} {...props} />;
};

export { useDateTimeFieldContext };

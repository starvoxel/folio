// ------------------------------
// choice-group.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import { Field, Radio, RadioGroup } from '@fluentui/react-components';

/** One option of a `ChoiceGroup`. */
export interface Choice<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly testId: string;
}

/** Properties of `ChoiceGroup`. */
export interface ChoiceGroupProps<Value extends string> {
  /** The question the group answers, such as "Theme". */
  readonly label: string;
  readonly choices: readonly Choice<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  readonly testId: string;
}

/**
 * A labelled group of mutually exclusive choices, such as light, dark or system.
 * @param props - The label, the choices and the selection.
 * @returns The group element.
 */
export function ChoiceGroup<Value extends string>(props: ChoiceGroupProps<Value>): ReactElement {
  return (
    <Field label={props.label}>
      <RadioGroup
        layout="horizontal"
        value={props.value}
        onChange={(_event, data) => {
          const chosen = props.choices.find((choice) => choice.value === data.value);
          if (chosen !== undefined) {
            props.onChange(chosen.value);
          }
        }}
        data-testid={props.testId}
      >
        {props.choices.map((choice) => (
          <Radio
            key={choice.value}
            value={choice.value}
            label={choice.label}
            data-testid={choice.testId}
          />
        ))}
      </RadioGroup>
    </Field>
  );
}

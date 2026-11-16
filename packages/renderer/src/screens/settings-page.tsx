// ------------------------------
// settings-page.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useState, type ReactElement } from 'react';

import { THEME_PREFERENCES, type ThemePreference } from '@folio/core';

import { useAppServices } from '../app/app-services.js';
import { chooseTheme } from '../app/app-state.js';
import { PAGES } from '../app/pages.js';
import { testIds } from '../app/test-ids.js';
import { useAppState } from '../app/use-app-state.js';
import {
  ActionButton,
  Card,
  ChoiceGroup,
  ConfirmDialog,
  Page,
  SecondaryText,
} from '../ui/fluent/index.js';

const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * The Settings page. It holds the theme choice (H1.9) and a reset with a confirmation dialog;
 * the other settings arrive with their features.
 * @returns The page element.
 */
export function SettingsPage(): ReactElement {
  const { host, store } = useAppServices();
  const state = useAppState(store);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const applyTheme = (theme: ThemePreference): void => {
    store.setState((current) => chooseTheme(current, theme));
    const save = async (): Promise<void> => {
      try {
        await host.writeSettings({ theme });
      } catch {
        // The choice still applies for this session; the next change tries to save again.
      }
    };
    void save();
  };

  return (
    <Page title={PAGES.settings.title} testId={testIds.page('settings')}>
      <Card title="Appearance">
        <ChoiceGroup
          label="Theme"
          choices={THEME_PREFERENCES.map((theme) => ({
            value: theme,
            label: THEME_LABELS[theme],
            testId: testIds.settings.themeOption(theme),
          }))}
          value={state.themePreference}
          onChange={applyTheme}
          testId={testIds.settings.theme}
        />
      </Card>
      <Card title="Reset">
        <SecondaryText>Put the settings on this computer back to their defaults.</SecondaryText>
        <div>
          <ActionButton
            label="Reset settings"
            testId={testIds.settings.reset}
            onClick={() => {
              setConfirmingReset(true);
            }}
          />
        </div>
      </Card>
      <ConfirmDialog
        open={confirmingReset}
        title="Reset settings?"
        message="The theme goes back to following the system. Your budget file is not changed."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        testId={testIds.dialog.resetSettings}
        onConfirm={() => {
          applyTheme('system');
          setConfirmingReset(false);
        }}
        onCancel={() => {
          setConfirmingReset(false);
        }}
      />
    </Page>
  );
}

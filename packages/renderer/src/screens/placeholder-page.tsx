// ------------------------------
// placeholder-page.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import { testIds } from '../app/test-ids.js';
import type { PageDefinition } from '../app/pages.js';
import { Card, Page, SecondaryText } from '../ui/fluent/index.js';

/**
 * A page that has no feature yet. Each real page replaces its placeholder when its plan lands.
 * @param props - Which page this stands in for.
 * @param props.page - The page definition.
 * @returns The page element.
 */
export function PlaceholderPage(props: { readonly page: PageDefinition }): ReactElement {
  return (
    <Page title={props.page.title} testId={testIds.page(props.page.id)}>
      <Card title="Not built yet">
        <SecondaryText>This page arrives with its feature.</SecondaryText>
      </Card>
    </Page>
  );
}

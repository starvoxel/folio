// ------------------------------
// app-services.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { createContext, useContext, type ReactElement, type ReactNode } from 'react';

import type { FormFactor, HostApi, InputStyle } from '@folio/host-api';

import type { AppStore } from './app-state.js';

/**
 * What every component may reach: the host, the state, the page's CSP nonce, and the form-factor
 * profile and input style the host reported at mount (AD-21).
 */
export interface AppServices {
  readonly host: HostApi;
  readonly store: AppStore;
  readonly cspNonce: string | undefined;
  readonly formFactor: FormFactor;
  readonly input: InputStyle;
}

const AppServicesContext = createContext<AppServices | null>(null);

/**
 * Make the services available to the components below.
 * @param props - The services and the tree that uses them.
 * @param props.services - The host, the store and the nonce.
 * @param props.children - The app tree.
 * @returns The provider element.
 */
export function AppServicesProvider(props: {
  readonly services: AppServices;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <AppServicesContext.Provider value={props.services}>
      {props.children}
    </AppServicesContext.Provider>
  );
}

/**
 * Read the services.
 * @returns The host, the store and the nonce.
 * @throws {Error} When used outside an `AppServicesProvider`.
 */
export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (services === null) {
    throw new Error('useAppServices must be used inside an AppServicesProvider');
  }
  return services;
}

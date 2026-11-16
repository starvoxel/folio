// ------------------------------
// layout-context.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  interactionFor,
  layoutFor,
  widthClassOf,
  type Interaction,
  type ResolvedLayout,
  type WidthClass,
} from '../layout/index.js';
import { useAppServices } from './app-services.js';

/** What the shell needs to arrange itself: the chosen layout and how controls behave. */
export interface LayoutState {
  readonly resolved: ResolvedLayout;
  readonly interaction: Interaction;
}

const LayoutContext = createContext<LayoutState | null>(null);

/**
 * Measure the area the app has and make the layout for it available below. This is the only
 * place that reads a width (AD-21): the width of its own element, so a split view or an embedding
 * is handled like a window, and only the class is kept in state so a resize re-renders the app
 * when the class changes, not on every pixel. Nothing below is drawn until the first measurement,
 * which happens before the first paint.
 * @param props - The content.
 * @param props.children - The app.
 * @returns The measured area with the layout context.
 */
export function LayoutProvider(props: { readonly children: ReactNode }): ReactElement {
  const { formFactor, input } = useAppServices();
  const areaRef = useRef<HTMLDivElement>(null);
  const [widthClass, setWidthClass] = useState<WidthClass | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (area === null) {
      return undefined;
    }
    setWidthClass(widthClassOf(area.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const latest = entries.at(-1);
      if (latest !== undefined) {
        setWidthClass(widthClassOf(latest.contentRect.width));
      }
    });
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, []);

  const state = useMemo<LayoutState | null>(
    () =>
      widthClass === null
        ? null
        : { resolved: layoutFor(formFactor, widthClass), interaction: interactionFor(input) },
    [formFactor, input, widthClass],
  );

  // The attributes are the layout as the page shows it, for tests and for anyone inspecting it.
  return (
    <div
      ref={areaRef}
      data-testid="layout-root"
      data-form-factor={formFactor}
      data-width-class={widthClass ?? undefined}
      data-layout-source={
        state === null
          ? undefined
          : `${state.resolved.source.profile}/${state.resolved.source.entry}`
      }
      data-target-size={state?.interaction.targetSize}
      data-hover-actions={state?.interaction.hoverActions}
    >
      {state === null ? null : (
        <LayoutContext.Provider value={state}>{props.children}</LayoutContext.Provider>
      )}
    </div>
  );
}

/**
 * Read the current layout. Only the app's top level uses it; screens never do (an architecture
 * check enforces this).
 * @returns The resolved layout and the interaction rules.
 * @throws {Error} When used outside a `LayoutProvider`.
 */
export function useLayout(): LayoutState {
  const state = useContext(LayoutContext);
  if (state === null) {
    throw new Error('useLayout must be used inside a LayoutProvider');
  }
  return state;
}

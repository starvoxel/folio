import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RendererProvider, createDOMRenderer } from '@fluentui/react-components';
import type { AppConfig, Dataset } from '../shared/types';
import { App } from './App';
import { tauriHost } from '../host/tauri';
import './styles.css';

// E2E builds only (vite --mode e2e): load the WebDriver helper that @wdio/tauri-service requires. Never in the shipped bundle.
if (import.meta.env.MODE === 'e2e') void import('@wdio/tauri-plugin');

const nonce = document.querySelector('meta[property="csp-nonce"]')?.getAttribute('content') ?? undefined;
const renderer = createDOMRenderer(document, nonce ? { styleElementAttributes: { nonce } } : undefined);

function Boot() {
  const [state, setState] = useState<{ config: AppConfig; dataset: Dataset } | { error: string } | null>(null);
  useEffect(() => {
    Promise.all([tauriHost.getConfig(), tauriHost.loadData()])
      .then(([config, dataset]) => setState({ config, dataset }))
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }));
  }, []);
  if (!state) return <div className="boot">Loading…</div>;
  if ('error' in state) return <div className="boot error" role="alert">Could not load data: {state.error}</div>;
  return <App config={state.config} dataset={state.dataset} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RendererProvider renderer={renderer} targetDocument={document}>
      <Boot />
    </RendererProvider>
  </StrictMode>,
);

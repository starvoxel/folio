import { invoke } from '@tauri-apps/api/core';
import type { AppConfig } from '../shared/types';
import { parseDataset } from '../shared/validate';
import type { HostApi } from './hostApi';

// Adapter for the Tauri shell. Four commands, all defined in src-tauri/src/lib.rs and listed in the capability file.
export const tauriHost: HostApi = {
  getConfig: () => invoke<AppConfig>('get_config'),
  async loadData() {
    // One IPC call returns {"accounts":..,"categories":..,"transactions":..} as raw JSON bytes; Rust does not parse it.
    const text = new TextDecoder().decode(await invoke<ArrayBuffer>('load_data')); // raw bytes, not a JSON-encoded string
    const raw = JSON.parse(text) as { accounts: unknown; categories: unknown; transactions: unknown };
    return parseDataset(raw.accounts, raw.categories, raw.transactions);
  },
  async openFileDialog() {
    try { return await invoke<string | null>('open_csv_dialog'); } catch { return null; } // absent in the measured slice build
  },
  quit: () => invoke<void>('quit_app'),
};

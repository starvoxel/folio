import type { AppConfig, Dataset } from '../shared/types';

/**
 * Everything the renderer may ask of its shell. This is the whole surface; the renderer imports nothing
 * shell-specific. A web build would provide another implementation (fetch + File System Access API, say).
 * The test/agent state hook (`window.__folio`) is published by the renderer itself and needs no host support.
 */
export interface HostApi {
  /** Static facts: file name, whether the shell was started in automation mode, platform. */
  getConfig(): Promise<AppConfig>;
  /** Load and validate the three fixture files. */
  loadData(): Promise<Dataset>;
  /** Native "open file" dialog for CSV import. Null if cancelled or unsupported by this shell build. */
  openFileDialog(): Promise<string | null>;
  /** Ask the shell to exit with code 0. */
  quit(): Promise<void>;
}

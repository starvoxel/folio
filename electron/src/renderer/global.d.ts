import type { FolioBridge } from '../shared/types';

declare global {
  interface Window {
    folio?: FolioBridge;
    /** Present only when the app was started with FOLIO_AUTOMATION=1. */
    __folio?: import('./automation').AutomationApi;
  }
}
export {};

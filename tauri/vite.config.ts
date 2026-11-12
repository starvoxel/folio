import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer build. The only change from the Electron slice is the build target: Electron's was chrome140; the
// system web views are WebKit (macOS, Linux) and WebView2 (Windows), so target the oldest we care to run on.
export default defineConfig(({ mode }) => ({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: { outDir: mode === 'e2e' ? '../../dist-e2e' : '../../dist', emptyOutDir: true, target: ['safari16', 'chrome110'], sourcemap: false },
}));

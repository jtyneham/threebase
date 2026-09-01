import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        playground: fileURLToPath(new URL('./playground/index.html', import.meta.url)),
        objectLab: fileURLToPath(new URL('./object-lab/index.html', import.meta.url)),
        hallerPocketKnife: fileURLToPath(
          new URL('./object-lab/haller-pocket-knife/index.html', import.meta.url),
        ),
        bicMiniLighter: fileURLToPath(
          new URL('./object-lab/bic-mini-lighter/index.html', import.meta.url),
        ),
      },
    },
  },
});

import path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/main_types.ts'),
      name: 'comfyui-electron-api',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['electron'],
    },
    minify: false,
  },
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
});

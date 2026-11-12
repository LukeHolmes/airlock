import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.tsx', 'src/main/**/*.test.ts'],
    environmentMatchGlobs: [['src/main/**', 'node']],
  },
});

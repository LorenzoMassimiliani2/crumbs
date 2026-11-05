import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const FETCH_SETUP = './src/test/setup-fetch.ts'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'worker',
          environment: 'node',
          include: ['src/worker/**/*.test.ts', 'src/test/**/*.test.ts'],
          setupFiles: [FETCH_SETUP],
        },
      },
      {
        test: {
          name: 'views',
          environment: 'happy-dom',
          include: [
            'src/views/**/*.test.ts',
            'src/components/**/*.test.ts',
            'src/composables/**/*.test.ts',
          ],
          setupFiles: [FETCH_SETUP],
        },
      },
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/lib/**/*.test.ts'],
          setupFiles: [FETCH_SETUP],
        },
      },
    ],
  },
})

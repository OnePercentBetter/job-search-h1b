import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'scripts/crawlers/__tests__/**/*.test.ts',
      'apps/api/src/services/__tests__/**/*.test.ts',
    ],
  },
})

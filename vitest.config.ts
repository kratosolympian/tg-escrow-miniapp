import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  },
  test: {
    // Only run unit tests under test/ (exclude Playwright tests under tests/)
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})

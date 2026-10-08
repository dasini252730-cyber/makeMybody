import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Vite 설정(@ alias 등)을 그대로 물려받고 테스트 옵션만 얹는다.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.ts'],
        exclude: ['src/**/*.test.ts'],
      },
    },
  }),
)

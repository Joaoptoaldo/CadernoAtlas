import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const webRoot = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const projectRequire = createRequire(import.meta.url)

export default defineConfig({
  root: webRoot,

  plugins: [react()],

  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },

  resolve: {
    alias: [
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: projectRequire.resolve('react/jsx-dev-runtime'),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: projectRequire.resolve('react/jsx-runtime'),
      },
      {
        find: /^react-dom\/client$/,
        replacement: projectRequire.resolve('react-dom/client'),
      },
      {
        find: /^react-dom\/test-utils$/,
        replacement: projectRequire.resolve('react-dom/test-utils'),
      },
      {
        find: /^react-dom$/,
        replacement: projectRequire.resolve('react-dom'),
      },
      {
        find: /^react$/,
        replacement: projectRequire.resolve('react'),
      },
      {
        find: /^@testing-library\/react$/,
        replacement: projectRequire.resolve('@testing-library/react'),
      },
    ],
  },

  test: {
    include: [
      '../../tests/CadernoAtlas.Web.Tests/**/*.test.{js,jsx}',
    ],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    clearMocks: true,
  },
})

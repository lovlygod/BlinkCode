import { defineConfig } from 'electron-vite'

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: 'electron/main.mjs' },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: 'blinkcode:node-pty-narrower',
        enforce: 'pre',
        resolveId(source: string) {
          if (source === '@lydell/node-pty') return nodePtyPkg
          return null
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: 'electron/preload.cjs' },
      },
    },
  },
})

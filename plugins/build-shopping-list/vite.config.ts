import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

function copyManifestPlugin(): { name: string; closeBundle: () => void } {
  return {
    name: 'copy-manifest',
    closeBundle() {
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'))
    },
  }
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: () => 'plugin.js',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-dom/server',
        'react/jsx-runtime',
        '@scalpelpoe/plugin-sdk',
      ],
    },
    minify: 'esbuild',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
})

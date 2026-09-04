import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base pode ser sobrescrito pelo workflow do GitHub Pages (BASE_PATH)
const versao = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  define: { __VERSAO__: JSON.stringify(versao) },
})

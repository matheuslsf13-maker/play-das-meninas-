import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base pode ser sobrescrito pelo workflow do GitHub Pages (BASE_PATH)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
})

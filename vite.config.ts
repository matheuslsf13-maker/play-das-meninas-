import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Caminhos RELATIVOS de proposito: assim o mesmo build funciona na raiz do
// dominio (playdetodas.com.br) e tambem em subpasta (o endereco antigo do
// GitHub Pages). Sem isso, a troca de endereco quebraria o site enquanto o
// DNS nao propagasse.
const versao = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __VERSAO__: JSON.stringify(versao) },
})

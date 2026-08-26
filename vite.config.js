import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 部署路徑（本機開發時自動忽略）
  base: process.env.NODE_ENV === 'production' ? '/tool-screener-v2/' : '/',
  plugins: [
    tailwindcss(),
    vue(),
  ],
})

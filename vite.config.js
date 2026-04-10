import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/screenplay-workshop/',
  server: { port: 5174, open: false }
})

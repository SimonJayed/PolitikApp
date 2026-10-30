import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (process.env.VERCEL === '1') {
    const origin = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL
    let url
    try { url = new URL(origin) } catch { /* The deployment error below explains the required value. */ }
    if (!url || url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)
      || url.username || url.password) {
      throw new Error('Vercel needs VITE_API_BASE_URL set to the public HTTPS backend origin before building.')
    }
  }
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
  }
})

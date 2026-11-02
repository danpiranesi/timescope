import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev` runs `vercel dev`, which hosts the API functions and proxies to Vite.
// `npm run dev:lan` runs Vite alone over HTTPS on the LAN (needed for camera/compass on
// a phone) and proxies /api to the vercel dev server on port 3000.
const lan = process.env.VITE_HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(lan ? [basicSsl()] : [])],
  server: {
    host: lan,
    proxy: lan ? { '/api': { target: 'http://localhost:3000', changeOrigin: true } } : undefined,
  },
});

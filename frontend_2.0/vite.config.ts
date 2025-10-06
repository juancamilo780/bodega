import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
        '/token': { target, changeOrigin: true, secure: false },
        '/files': { target, changeOrigin: true, secure: false },
      },
    },
  };
});

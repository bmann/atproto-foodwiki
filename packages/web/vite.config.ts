import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Expose over the exe.dev proxy when needed (this VM's browser is public).
    host: true,
  },
});

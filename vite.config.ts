import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Expose les variables REACT_APP_* comme import.meta.env.VITE_*
  // ET en tant que process.env.REACT_APP_* pour compatibilité avec le code existant
  define: {
    'process.env.REACT_APP_BACKEND_URL':     JSON.stringify(process.env.REACT_APP_BACKEND_URL    || ''),
    'process.env.REACT_APP_SUPABASE_URL':    JSON.stringify(process.env.REACT_APP_SUPABASE_URL   || ''),
    'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(process.env.REACT_APP_SUPABASE_ANON_KEY || ''),
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});

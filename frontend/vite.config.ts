import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // This forces everything to use the main frontend copy of React
    dedupe: ['react', 'react-dom'],
  },
})
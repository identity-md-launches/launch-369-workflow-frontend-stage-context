import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { deployment } from './scripts/deployment.ts'

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'runtime-deployment-dev',
    configureServer(server) {
      server.middlewares.use('/imd-deployment.json', async (_req, res) => {
        try { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await deployment())) }
        catch { res.statusCode = 500; res.end('Deployment validation failed') }
      })
    },
  }],
  build: { outDir: '../dist', emptyOutDir: true },
})

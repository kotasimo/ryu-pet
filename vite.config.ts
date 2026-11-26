import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite's default publicDir copies everything into dist. Private photo layers
// are served only by the local development server and never enter a build.
const privateRoot = resolve('public/private-assets/ryu/model-v1')
const allowed = /^(?:manifest\.json|motion-video-3(?:-return)?\.json|(?:body|head|side_head|ear_left|ear_right|eye_left|eye_right|cheek_left|cheek_right|mouth|eyelid_left|eyelid_right)\.png)$/

export default defineConfig({
  plugins: [react(), {
    name: 'local-private-model-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = /^\/private-assets\/ryu\/model-v1\/([^/]+)$/.exec(new URL(request.url ?? '/', 'http://localhost').pathname)
        if (!match) return next()
        if (!allowed.test(match[1])) { response.writeHead(404).end(); return }
        try {
          const data = await readFile(resolve(privateRoot, match[1]))
          response.setHeader('Content-Type', match[1].endsWith('.json') ? 'application/json' : 'image/png')
          response.setHeader('Cache-Control', 'no-store')
          response.end(data)
        } catch { response.writeHead(404).end() }
      })
    },
  }],
  publicDir: false,
})

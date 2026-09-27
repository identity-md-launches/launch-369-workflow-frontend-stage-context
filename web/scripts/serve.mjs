import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../dist/', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    if (!url.pathname.startsWith('/preview/')) { response.writeHead(404).end(); return }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname.slice('/preview'.length)) + (url.pathname.endsWith('/') ? 'index.html' : ''))
    if (!path.startsWith(root)) { response.writeHead(403).end(); return }
    const bytes = await readFile(path)
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(bytes)
  } catch { response.writeHead(404).end() }
}).listen(4173, '0.0.0.0', () => console.log('Static export: http://localhost:4173/preview/'))

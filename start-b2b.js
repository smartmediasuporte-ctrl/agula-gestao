import { createServer } from './halo-b2b/node_modules/vite/dist/node/index.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, 'halo-b2b')

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  server: { port: 5173 }
})
await server.listen()
server.printUrls()

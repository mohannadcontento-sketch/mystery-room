import { createServer } from 'http'
import { Server } from 'socket.io'

console.log('[mystery] starting...')

const httpServer = createServer((req, res) => {
  console.log('[mystery] req:', req.url)
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('ok')
})

const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

io.on('connection', (socket) => {
  console.log('[mystery] connect', socket.id)
  socket.on('disconnect', () => console.log('[mystery] disconnect', socket.id))
})

httpServer.listen(3003, () => {
  console.log('[mystery] listening on 3003')
})

process.on('SIGTERM', () => {
  console.log('[mystery] SIGTERM')
  process.exit(0)
})
process.on('SIGINT', () => {
  console.log('[mystery] SIGINT')
  process.exit(0)
})
process.on('uncaughtException', (e) => {
  console.log('[mystery] uncaughtException:', e)
})
process.on('unhandledRejection', (e) => {
  console.log('[mystery] unhandledRejection:', e)
})

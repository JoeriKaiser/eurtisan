const port = Number(process.env.PORT) || 9323

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req: Request) {
    const url = new URL(req.url)
    let path = url.pathname
    if (path === '/') path = '/index.html'

    const filePath = `./e2e/report${path}`
    const file = Bun.file(filePath)

    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 })
    }

    return new Response(file)
  },
})

console.log(`Report server running at http://localhost:${port}`)

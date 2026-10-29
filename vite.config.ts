import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** Serves netlify/functions/enquiry.mts at /api/enquiry under `npm run dev`, as Netlify does live. */
function enquiryFunction(): Plugin {
  return {
    name: 'enquiry-function',
    configureServer(server) {
      // RESEND_* from .env.local, for the function only (Vite exposes just VITE_* to the page).
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), 'RESEND_'))
      server.middlewares.use('/api/enquiry', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const { default: handler } = await server.ssrLoadModule('/netlify/functions/enquiry.mts')
        const response: Response = await handler(
          new Request(`http://localhost${req.originalUrl}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          }),
        )
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), enquiryFunction()],
  server: {
    host: true,
    // Native fs events are unreliable on this drive/path; poll instead.
    watch: { usePolling: true },
  },
})

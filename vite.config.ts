import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const HARNESS_FILES: Record<string, string> = {
  workspace: 'AGENTS.md',
  frontend: path.join('harness', 'frontend.md'),
  backend: path.join('harness', 'backend.md'),
}

/**
 * 本地开发/预览服务：读取并写回工作区与前后端 Harness 配置。
 * 静态托管时该接口不存在，前端会退化为内置模板 + 复制/下载。
 */
function harnessApiPlugin(): Plugin {
  async function handler(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    if (!req.url || !req.url.startsWith('/api/harness')) {
      next()
      return
    }

    const send = (status: number, payload: unknown): void => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(payload))
    }

    const requestUrl = new URL(req.url, 'http://localhost')
    const target = requestUrl.searchParams.get('target') || 'workspace'
    const relativeFile = HARNESS_FILES[target]
    if (!relativeFile) {
      send(400, { ok: false, error: '未知的配置目标' })
      return
    }
    const file = path.resolve(process.cwd(), relativeFile)

    if (req.method === 'GET') {
      try {
        const [content, stat] = await Promise.all([
          fs.readFile(file, 'utf8'),
          fs.stat(file),
        ])
        send(200, {
          ok: true,
          target,
          file: relativeFile,
          content,
          updated: stat.mtime.toISOString(),
        })
      } catch {
        send(404, { ok: false, error: `${relativeFile} 不存在` })
      }
      return
    }

    if (req.method !== 'POST') {
      send(405, { ok: false, error: '只支持 GET / POST' })
      return
    }

    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      raw += chunk
      if (raw.length > 2_000_000) req.destroy()
    })
    req.on('end', () => {
      void (async () => {
        try {
          const payload = JSON.parse(raw || '{}') as { content?: unknown }
          const content = typeof payload.content === 'string' ? payload.content : ''
          if (!content.trim()) throw new Error('内容不能为空')
          await fs.mkdir(path.dirname(file), { recursive: true })
          await fs.writeFile(file, `${content.trimEnd()}\n`, 'utf8')
          send(200, { ok: true, target, file: relativeFile })
        } catch (error) {
          send(500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })()
    })
  }

  return {
    name: 'ai-workspace-harness-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handler(req, res, next))
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), harnessApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: [
        '**/shots/**',
        '**/scripts/**',
        '**/dist/**',
        '**/*.tmpdir/**',
        '**/.*.tmpdir/**',
        '**/*.tmp',
        '**/.acl-recovery/**',
        '**/.*.tmpdir/*',
      ],
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2400,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-antd': ['ant-design-vue', '@ant-design/icons-vue'],
          'vendor-markdown': ['markdown-it', 'dompurify', 'highlight.js'],
        },
      },
    },
  },
})

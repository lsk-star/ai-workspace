import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 单份 Harness 规则主文件（harness/*.md）的字符上限；超出应拆分到附属文档 */
const HARNESS_LIMIT = 2500

/** 前端约定的保留目标名：list 用于枚举规则，workspace / projects 各对应一个根目录文件 */
const RESERVED_TARGETS = new Set(['list', 'workspace', 'projects'])

/** 规则名允许中文、字母、数字、中划线、下划线；不含空格、点、斜杠，防目录穿越 */
const RULE_KEY_RE = /^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9_-]{0,63}$/u

/** 目标名 → 相对文件路径；未知目标返回 null（不是合法规则名）。展示用统一正斜杠 */
function fileForTarget(target: string): string | null {
  if (target === 'workspace') return 'AGENTS.md'
  if (target === 'projects') return 'workspace.json'
  if (RULE_KEY_RE.test(target) && !RESERVED_TARGETS.has(target)) {
    return `harness/${target}.md`
  }
  return null
}

/** 是否为 harness 规则文件目标（受 2500 字符上限约束）；workspace 与 projects 不受限 */
function isHarnessRule(target: string): boolean {
  return target !== 'workspace' && target !== 'projects'
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

/** 规则显示名来自 harness/rules.json（单一来源），缺失时退化为文件名 */
async function readRuleLabels(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.resolve(process.cwd(), 'harness', 'rules.json'), 'utf8')
    const parsed = JSON.parse(raw) as { labels?: Record<string, string> }
    return parsed.labels ?? {}
  } catch {
    return {}
  }
}

/** 枚举全部规则：根目录 AGENTS.md + rules.json 登记的规则 + harness/ 下实际存在的规则文件 */
async function listTargets(): Promise<unknown[]> {
  const labels = await readRuleLabels()
  const harnessDir = path.join(process.cwd(), 'harness')
  const entries = await fs.readdir(harnessDir, { withFileTypes: true }).catch(() => [])
  const found = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name.replace(/\.md$/i, ''))
  const names = [...new Set([...Object.keys(labels), ...found])].filter(
    (name) => RULE_KEY_RE.test(name) && !RESERVED_TARGETS.has(name),
  )
  const targets = [
    { key: 'workspace', file: 'AGENTS.md', label: '工作区规则', exists: true, limit: 0 },
  ]
  for (const name of names) {
    const file = `harness/${name}.md`
    const exists = await fileExists(path.resolve(process.cwd(), file))
    targets.push({ key: name, file, label: labels[name] || name, exists, limit: HARNESS_LIMIT })
  }
  return targets
}

/**
 * 本地开发/预览服务：读取并写回工作区规则（AGENTS.md）与 harness 规则文件。
 * 规则名即 harness/ 下的文件名（去掉 .md），下拉里可以新建规则，保存时自动创建文件。
 * harness 规则主文件写入超过 HARNESS_LIMIT 会被拒绝，避免膨胀拖慢每次会话。
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
      // 禁止浏览器缓存：规则文件随时可能被编辑，启发式缓存会拿到旧内容
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(payload))
    }

    const requestUrl = new URL(req.url, 'http://localhost')
    const target = requestUrl.searchParams.get('target') || 'workspace'

    if (req.method === 'GET' && target === 'list') {
      send(200, { ok: true, targets: await listTargets() })
      return
    }

    const relativeFile = fileForTarget(target)
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
          exists: true,
        })
      } catch {
        // 规则文件还不存在（例如新登记的规则）：返回空内容，前端按「暂无内容」处理
        send(200, { ok: true, target, file: relativeFile, content: '', exists: false })
      }
      return
    }

    if (req.method !== 'POST') {
      send(405, { ok: false, error: '只支持 GET / POST' })
      return
    }

    // 只允许同源页面写入，避免任意网页改写 AGENTS.md / harness
    const origin = req.headers.origin
    if (origin) {
      let sameOrigin = false
      try {
        sameOrigin = new URL(origin).host === req.headers.host
      } catch {
        sameOrigin = false
      }
      if (!sameOrigin) {
        send(403, { ok: false, error: '拒绝跨源写入' })
        return
      }
    }
    // 要求 JSON：跨站请求会先走预检，预检得不到 CORS 响应即被浏览器拦下
    if (!String(req.headers['content-type'] || '').includes('application/json')) {
      send(415, { ok: false, error: '需要 Content-Type: application/json' })
      return
    }

    const MAX_BODY = 2_000_000
    let raw = ''
    let tooLarge = false
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      if (tooLarge) return
      raw += chunk
      if (raw.length > MAX_BODY) {
        tooLarge = true
        raw = ''
        send(413, { ok: false, error: '内容过大，上限 2 MB' })
        req.resume()
      }
    })
    req.on('end', () => {
      if (tooLarge) return
      void (async () => {
        try {
          const payload = JSON.parse(raw || '{}') as { content?: unknown }
          const content = typeof payload.content === 'string' ? payload.content : ''
          if (!content.trim()) throw new Error('内容不能为空')
          if (isHarnessRule(target) && content.length > HARNESS_LIMIT) {
            send(400, {
              ok: false,
              error: `内容 ${content.length} 字符，超过 ${HARNESS_LIMIT} 上限；请把细节拆分到 harness/ 下按主题命名的附属文档，主文件只留清单`,
            })
            return
          }
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
        // harness 规则与 AGENTS.md 在 dev 下由 /api/harness 实时读取，
        // 它们只以 ?raw 形式参与静态托管兜底，监听变化只会造成无意义的 HMR 重挂载
        '**/harness/**',
        '**/AGENTS.md',
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

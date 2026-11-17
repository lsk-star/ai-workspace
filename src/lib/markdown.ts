import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import type { Heading } from '@/types/content'
import { dirname, normalizePath, resolveAssetPath, slugifyHeading } from '@/lib/paths'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

// 关闭“模糊链接”：否则 AGENTS.md、backend.md 这类文件名会被当成网址
md.linkify.set({ fuzzyLink: false })

md.options.highlight = (code: string, lang: string): string => {
  const language = lang && hljs.getLanguage(lang) ? lang : ''
  try {
    const result = language
      ? hljs.highlight(code, { language, ignoreIllegals: true })
      : hljs.highlightAuto(code)
    return `<pre class="hljs"><code class="language-${language || 'plaintext'}">${result.value}</code></pre>`
  } catch {
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
  }
}

export interface RenderOptions {
  docPath: string
  /** 将文档内相对/绝对资源路径解析成可显示的 URL */
  resolveAsset: (targetPath: string) => Promise<string | null>
}

export interface RenderResult {
  html: string
  headings: Heading[]
  /** 本次渲染创建的 Blob URL，由调用方负责释放 */
  objectUrls: string[]
}

/**
 * 渲染 Markdown：清洗 → 标题加锚点 → 图片/链接改写。
 * 没有使用 markdown-it-anchor，避免标题 id 与目录提取出现两套 slug 逻辑。
 */
export async function renderMarkdown(
  source: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const raw = md.render(source)
  const clean = DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel', 'data-md-path', 'data-broken'],
    USE_PROFILES: { html: true },
  })

  const doc = new DOMParser().parseFromString(`<div id="root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('root')!
  const headings: Heading[] = []
  const used = new Map<string, number>()

  root.querySelectorAll('h1, h2, h3, h4').forEach((el, index) => {
    const text = (el.textContent || '').trim()
    if (!text) return
    const base = slugifyHeading(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    el.id = id
    headings.push({ id, text, level: Number(el.tagName.slice(1)) || index + 1 })
  })

  const objectUrls: string[] = []
  const baseDir = dirname(options.docPath)
  const docDirName = options.docPath

  root.querySelectorAll('img').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim()
    if (!src || /^(https?:|data:|blob:)/i.test(src)) return

    const target = resolveAssetPath(baseDir, src)
    img.setAttribute('data-src', target)
    img.setAttribute('src', '')
  })

  // 图片读取是异步的，逐个解析
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const target = img.getAttribute('data-src')
    if (!target) continue
    try {
      const url = await options.resolveAsset(target)
      if (url) {
        img.setAttribute('src', url)
        objectUrls.push(url)
        img.removeAttribute('data-src')
      } else {
        throw new Error('missing')
      }
    } catch {
      img.removeAttribute('data-src')
      img.setAttribute('data-broken', 'true')
      const alt = img.getAttribute('alt') || '图片'
      img.setAttribute('alt', `${alt}（未找到：${normalizePath(target)}）`)
    }
  }

  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (!href) return
    if (/^https?:/i.test(href) || href.startsWith('mailto:')) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
      return
    }
    if (href.startsWith('#')) return
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return

    const hashIndex = href.indexOf('#')
    const hash = hashIndex >= 0 ? href.slice(hashIndex) : ''
    const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href
    const target = resolveAssetPath(baseDir, decodeURIComponent(rawPath))
    anchor.setAttribute('data-md-path', target)
    anchor.setAttribute('data-md-hash', hash)
    anchor.setAttribute('href', `#/doc/${target}`)
    if (docDirName) anchor.setAttribute('title', target)
  })

  return {
    html: root.innerHTML,
    headings,
    objectUrls,
  }
}

export function extractTitle(source: string): string {
  const match = source.match(/^\s*#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

export function countWords(source: string): number {
  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*`_~\-|]/g, ' ')
    .trim()
  if (!plain) return 0
  const cjk = plain.match(/[\u4e00-\u9fa5]/g)?.length ?? 0
  const words = plain
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter((item) => item.length > 0).length
  return cjk + words
}

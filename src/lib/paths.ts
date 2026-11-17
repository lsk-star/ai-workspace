export function normalizePath(input: string): string {
  const parts = input.replace(/\\/g, '/').split('/')
  const out: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

export function dirname(path: string): string {
  const p = normalizePath(path)
  const index = p.lastIndexOf('/')
  return index <= 0 ? '' : p.slice(0, index)
}

export function basename(path: string): string {
  const p = normalizePath(path)
  const index = p.lastIndexOf('/')
  return index < 0 ? p : p.slice(index + 1)
}

export function extname(path: string): string {
  const name = basename(path)
  const index = name.lastIndexOf('.')
  return index <= 0 ? '' : name.slice(index + 1).toLowerCase()
}

/** 把文档内的相对/绝对引用解析为空间内的绝对路径 */
export function resolveAssetPath(baseDir: string, target: string): string {
  const clean = target.split('#')[0].split('?')[0]
  if (clean.startsWith('/')) return normalizePath(clean)
  return normalizePath(baseDir ? `${baseDir}/${clean}` : clean)
}

/** 生成稳定、可读的标题锚点 id（支持中文） */
export function slugifyHeading(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[`*_~[\]()#>!.,;:?'"“”‘’、，。；：！？]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64)
  return base || 'section'
}

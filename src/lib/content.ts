import type { DocMeta, FileNode } from '@/types/content'

/** 空间品牌信息 */
export const SPACE = {
  name: 'ai-workspace',
  tagline: 'AI 统一查看的知识空间',
  entry: '开始阅读/这是什么',
}

/** 左侧目录的固定排序 */
export const CATEGORY_ORDER = [
  '开始阅读',
  '产品空间',
  '设计空间',
  '技术空间',
  '运维空间',
  '测试空间',
  '空间配置',
]

const modules = import.meta.glob('/content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

interface FrontMatter {
  data: Record<string, string>
  body: string
}

function parseFrontMatter(raw: string): FrontMatter {
  const cleaned = raw.replace(/^\uFEFF/, '')
  const match = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: cleaned }
  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return { data, body: cleaned.slice(match[0].length) }
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toDoc(file: string, raw: string): DocMeta {
  const relative = file.replace(/^\/content\//, '').replace(/\.md$/i, '')
  const parts = relative.split('/')
  const category = parts.length > 1 ? parts[0] : '未分类'
  const folderPath = parts.slice(0, -1).join('/')
  const { data, body } = parseFrontMatter(raw)
  const title = data.title || parts[parts.length - 1] || '未命名文档'
  return {
    path: relative,
    file: relative,
    category,
    folderPath,
    title,
    updated: data.updated || '',
    tags: (data.tags || '')
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean),
    cover: data.cover || '',
    summary: data.summary || '',
    part: data.part || '',
    status: data.status || '',
    notice: data.notice || '',
    body,
    order: Number(data.order ?? 100),
    plain: stripMarkdown(body),
    harness: data.harness === 'true',
    configCenter: data.configCenter === 'true',
  }
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category)
  return index < 0 ? 999 : index
}

export const docs: DocMeta[] = Object.entries(modules)
  .map(([file, raw]) => toDoc(file, raw))
  .sort((a, b) => {
    const byCategory = categoryRank(a.category) - categoryRank(b.category)
    if (byCategory !== 0) return byCategory
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title, 'zh-Hans-CN')
  })

export const docMap = new Map<string, DocMeta>(docs.map((doc) => [doc.path, doc]))

export const categories: string[] = [...new Set(docs.map((doc) => doc.category))].sort(
  (a, b) => categoryRank(a) - categoryRank(b),
)

export function buildTree(): FileNode[] {
  const roots: FileNode[] = categories.map((category) => ({
    key: category,
    name: category,
    path: category,
    kind: 'dir' as const,
    children: [],
  }))
  const index = new Map<string, FileNode>(roots.map((node) => [node.path, node]))

  for (const doc of docs) {
    const segments = doc.path.split('/')
    let parent = index.get(doc.category)
    if (!parent) continue
    let acc = doc.category
    for (let i = 1; i < segments.length - 1; i += 1) {
      acc = `${acc}/${segments[i]}`
      let dir = index.get(acc)
      if (!dir) {
        dir = {
          key: acc,
          name: segments[i],
          path: acc,
          kind: 'dir',
          children: [],
        }
        index.set(acc, dir)
        parent.children!.push(dir)
      }
      parent = dir
    }
    parent.children!.push({
      key: doc.path,
      name: doc.title,
      path: doc.path,
      kind: 'file',
      doc,
    })
  }

  const FOLDER_ORDER = ['前端', '后端']
  const folderRank = (name: string): number => {
    const index = FOLDER_ORDER.indexOf(name)
    return index < 0 ? FOLDER_ORDER.length : index
  }

  const sortNodes = (nodes: FileNode[]): void => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      if (a.kind === 'dir') {
        const diff = folderRank(a.name) - folderRank(b.name)
        if (diff !== 0) return diff
      } else {
        const orderA = a.doc?.order ?? 100
        const orderB = b.doc?.order ?? 100
        if (orderA !== orderB) return orderA - orderB
      }
      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children)
    })
  }
  roots.forEach((root) => {
    if (root.children) sortNodes(root.children)
  })
  return roots
}

export function ancestorPaths(path: string): string[] {
  const parts = path.split('/')
  const result: string[] = []
  for (let i = 1; i < parts.length; i += 1) {
    result.push(parts.slice(0, i).join('/'))
  }
  return result
}

export function findDoc(path: string): DocMeta | undefined {
  return docMap.get(path)
}

/** 阅读顺序（分类 → order → 标题）中的前一篇与后一篇 */
export function neighborsOf(path: string): { prev: DocMeta | null; next: DocMeta | null } {
  const index = docs.findIndex((doc) => doc.path === path)
  if (index < 0) return { prev: null, next: null }
  return {
    prev: index > 0 ? (docs[index - 1] ?? null) : null,
    next: index < docs.length - 1 ? (docs[index + 1] ?? null) : null,
  }
}

export function entryDoc(): DocMeta {
  return docMap.get(SPACE.entry) ?? docs[0]
}

export function snippetOf(doc: DocMeta, keyword: string): string {
  const index = doc.plain.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0) return doc.summary || ''
  const start = Math.max(0, index - 24)
  const end = Math.min(doc.plain.length, index + keyword.length + 46)
  return `${start > 0 ? '…' : ''}${doc.plain.slice(start, end)}${end < doc.plain.length ? '…' : ''}`
}

export function searchDocs(keyword: string, scope: string): DocMeta[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return []
  return docs
    .filter((doc) => scope === '全部资料' || doc.category === scope)
    .filter((doc) => {
      if (doc.title.toLowerCase().includes(query)) return true
      if (doc.summary.toLowerCase().includes(query)) return true
      if (doc.tags.some((tag) => tag.toLowerCase().includes(query))) return true
      return doc.plain.toLowerCase().includes(query)
    })
    .slice(0, 40)
}

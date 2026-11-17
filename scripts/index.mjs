import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = path.join(root, 'content')
const output = path.join(root, 'knowledge-index.json')

function parseFrontMatter(raw) {
  const cleaned = raw.replace(/^\uFEFF/, '')
  const match = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { data: {}, body: cleaned }
  const data = {}
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

function headingsOf(body) {
  const headings = []
  const pattern = /^(#{2,4})\s+(.+)$/gm
  let match
  while ((match = pattern.exec(body))) {
    headings.push({ level: match[1].length, text: match[2].trim() })
  }
  return headings
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name.endsWith('.md')) files.push(full)
  }
  return files
}

const CATEGORY_ORDER = [
  '开始阅读',
  '产品空间',
  '设计空间',
  '技术空间',
  '运维空间',
  '测试空间',
  '空间配置',
]

const categoryRank = (category) => {
  const index = CATEGORY_ORDER.indexOf(category)
  return index < 0 ? CATEGORY_ORDER.length : index
}

const files = (await walk(contentRoot)).sort((a, b) =>
  a.localeCompare(b, 'zh-Hans-CN'),
)

const documents = []
for (const file of files) {
  const raw = await fs.readFile(file, 'utf8')
  const { data, body } = parseFrontMatter(raw)
  const relative = path
    .relative(contentRoot, file)
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
  const parts = relative.split('/')
  documents.push({
    path: relative,
    file: `${relative}.md`,
    title: data.title || parts[parts.length - 1],
    category: parts[0],
    folder: parts.slice(0, -1).join('/'),
    tags: (data.tags || '')
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean),
    summary: data.summary || '',
    updated: data.updated || '',
    status: data.status || '',
    order: Number(data.order ?? 100),
    headings: headingsOf(body),
  })
}

documents.sort((a, b) => {
  const byCategory = categoryRank(a.category) - categoryRank(b.category)
  if (byCategory !== 0) return byCategory
  if (a.order !== b.order) return a.order - b.order
  return a.title.localeCompare(b.title, 'zh-Hans-CN')
})

const categories = [...new Set(documents.map((doc) => doc.category))]
const index = {
  generatedAt: new Date().toISOString(),
  count: documents.length,
  categories,
  documents,
}

await fs.writeFile(output, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`knowledge-index.json → ${documents.length} documents, ${categories.length} categories`)

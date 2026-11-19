import type { DocMeta } from '@/types/content'
import { docMap, docs, snippetOf } from '@/lib/content'

/**
 * 构建时全文索引（public/search-index.json）：中文二字分词 + 英文单词的倒排表。
 * 首次搜索时懒加载一次并缓存；索引可用前或缺失时退回内存扫描，行为一致。
 * 加载失败不影响功能——本模块的所有查询都是同步的。
 */

interface SearchIndexData {
  docs: string[]
  tokens: Record<string, number[]>
}

let cachedIndex: SearchIndexData | null = null
let indexRequest: Promise<SearchIndexData | null> | null = null

/** 预取搜索索引（空闲时调用），失败静默，退回内存扫描 */
export function preloadSearchIndex(): void {
  void ensureIndex()
}

function ensureIndex(): Promise<SearchIndexData | null> {
  if (!indexRequest) {
    indexRequest = fetch('search-index.json')
      .then((response) => (response.ok ? (response.json() as Promise<SearchIndexData>) : null))
      .then((data) => {
        cachedIndex = data
        return data
      })
      .catch(() => null)
  }
  return indexRequest
}

/** 与 scripts/index.mjs 的分词规则保持一致 */
function queryTokens(keyword: string): { tokens: string[]; needsScanFallback: boolean } {
  const lower = keyword.toLowerCase()
  const tokens = new Set<string>()
  let usable = false
  for (const word of lower.match(/[a-z0-9][a-z0-9._-]*/g) ?? []) {
    if (word.length < 2 || word.length > 32) continue
    tokens.add(word)
    usable = true
  }
  for (const run of lower.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length < 2) continue
    usable = true
    for (let i = 0; i + 2 <= run.length; i += 1) {
      tokens.add(run.slice(i, i + 2))
    }
  }
  return { tokens: [...tokens], needsScanFallback: !usable }
}

function inScope(doc: DocMeta, scope: string): boolean {
  return scope === '全部资料' || doc.category === scope
}

/** 标题 / 标签 / 摘要命中的加权，正文命中数作为基础分 */
function metaBoost(doc: DocMeta, lower: string): number {
  let score = 0
  if (doc.title.toLowerCase().includes(lower)) score += 120
  if (doc.tags.some((tag) => tag.toLowerCase().includes(lower))) score += 40
  if (doc.summary.toLowerCase().includes(lower)) score += 20
  return score
}

function inMemoryScan(keyword: string, scope: string): Map<DocMeta, number> {
  const lower = keyword.trim().toLowerCase()
  const scores = new Map<DocMeta, number>()
  for (const doc of docs) {
    if (!inScope(doc, scope)) continue
    const matched =
      doc.title.toLowerCase().includes(lower) ||
      doc.summary.toLowerCase().includes(lower) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(lower)) ||
      doc.plain.toLowerCase().includes(lower)
    if (!matched) continue
    const occurrences = doc.plain.toLowerCase().split(lower).length - 1
    scores.set(doc, occurrences + metaBoost(doc, lower))
  }
  return scores
}

export function searchDocs(keyword: string, scope: string): DocMeta[] {
  const query = keyword.trim()
  if (!query) return []
  const lower = query.toLowerCase()

  let scores = new Map<DocMeta, number>()
  const { tokens, needsScanFallback } = queryTokens(query)
  if (cachedIndex && !needsScanFallback) {
    for (const token of tokens) {
      const posting = cachedIndex.tokens[token]
      if (!posting) continue
      for (let i = 0; i < posting.length; i += 2) {
        const doc = docMap.get(cachedIndex.docs[posting[i]] ?? '')
        if (!doc || !inScope(doc, scope)) continue
        scores.set(doc, (scores.get(doc) ?? 0) + posting[i + 1])
      }
    }
    for (const [doc, score] of scores) {
      const boosted = score + metaBoost(doc, lower)
      if (boosted !== score) scores.set(doc, boosted)
    }
  } else {
    scores = inMemoryScan(query, scope)
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].title.localeCompare(b[0].title, 'zh-Hans-CN'))
    .slice(0, 40)
    .map(([doc]) => doc)
}

export { snippetOf }

import workspaceAgents from '/AGENTS.md?raw'
import rulesManifest from '/harness/rules.json?raw'

/** 编辑器里的一条可编辑目标（规则文件或 workspace.json） */
export interface FileEditorTarget {
  key: string
  /** 展示与写入用的文件路径，如 harness/frontend.md */
  file: string
  /** 字符上限；0 / 未设置表示无上限 */
  limit?: number
}

/** Harness 规则目标：带下拉显示名与文件存在状态 */
export interface RuleTarget extends FileEditorTarget {
  label: string
  /** 文件当前是否存在；不存在的规则显示「暂无内容」，保存时自动创建 */
  exists: boolean
}

/** harness 规则主文件的字符上限；工作区规则（AGENTS.md）不设硬上限 */
export const HARNESS_LIMIT = 2500

/** 规则名允许中文、字母、数字、中划线、下划线；不含空格、点、斜杠，防目录穿越 */
export const RULE_NAME_RE = /^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9_-]{0,63}$/u

/** 保留目标名：list 用于枚举规则，workspace / projects 各对应一个根目录文件 */
export const RESERVED_NAMES = new Set(['list', 'workspace', 'projects'])

export function isValidRuleName(name: string): boolean {
  return RULE_NAME_RE.test(name) && !RESERVED_NAMES.has(name)
}

/** rules.json 的显示名登记（构建期读入，静态托管时同样可用） */
const manifestLabels: Record<string, string> = (() => {
  try {
    const parsed = JSON.parse(rulesManifest) as { labels?: Record<string, string> }
    return parsed.labels ?? {}
  } catch {
    return {}
  }
})()

/** 构建期捕获 harness/ 顶层规则文件内容，静态托管（无读接口）时作为初始内容兜底 */
const harnessFiles = import.meta.glob('/harness/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** key → 初始内容兜底（workspace 对应根目录 AGENTS.md） */
export const fallbackContents: Record<string, string> = { workspace: workspaceAgents }
for (const [file, raw] of Object.entries(harnessFiles)) {
  const name = file.replace(/^\/harness\//, '').replace(/\.md$/i, '')
  if (name && name !== 'README') fallbackContents[name] = raw
}

/** 静态托管时的规则清单兜底：workspace + rules.json 登记的规则 + 构建期实际存在的文件 */
export function staticTargets(): RuleTarget[] {
  const names = [
    ...new Set([...Object.keys(manifestLabels), ...Object.keys(fallbackContents)]),
  ].filter((name) => name !== 'workspace' && isValidRuleName(name))
  const targets: RuleTarget[] = [
    { key: 'workspace', file: 'AGENTS.md', label: '工作区规则', exists: true, limit: 0 },
  ]
  for (const name of names) {
    targets.push({
      key: name,
      file: `harness/${name}.md`,
      label: manifestLabels[name] || name,
      exists: name in fallbackContents,
      limit: HARNESS_LIMIT,
    })
  }
  return targets
}

/** 清洗规则清单接口返回，忽略非法条目 */
export function normalizeTargets(raw: unknown): RuleTarget[] {
  if (!Array.isArray(raw)) return []
  const result: RuleTarget[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key : ''
    const file = typeof record.file === 'string' ? record.file : ''
    if (!key || !file) continue
    result.push({
      key,
      file,
      label: typeof record.label === 'string' && record.label ? record.label : key,
      exists: record.exists === true,
      limit: typeof record.limit === 'number' ? record.limit : 0,
    })
  }
  return result
}

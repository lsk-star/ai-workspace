export interface DocMeta {
  /** 空间内路径（不含扩展名），例如 技术空间/前端/前端工程 */
  path: string
  /** 源文件路径，例如 技术空间/前端/前端工程.md */
  file: string
  /** 一级分类 */
  category: string
  /** 所在文件夹路径，例如 技术空间/前端 */
  folderPath: string
  title: string
  updated: string
  tags: string[]
  cover: string
  summary: string
  part: string
  status: string
  notice: string
  body: string
  order: number
  plain: string
  /** 是否为 Harness 配置入口（工作区 / 前端 / 后端三份配置） */
  harness: boolean
}

export interface Heading {
  id: string
  text: string
  level: number
}

export interface FileNode {
  key: string
  name: string
  path: string
  kind: 'dir' | 'file'
  doc?: DocMeta
  children?: FileNode[]
}

export interface SearchHit {
  doc: DocMeta
  snippet: string
}

export interface RecentDoc {
  path: string
  title: string
  at: number
}

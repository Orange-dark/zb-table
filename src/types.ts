/** 表格列配置 */
export interface ColumnConfig {
  /** 内置列：rank / player / kills / score；自定义列：随机 key */
  key: string
  title: string
  width: number
  minWidth: number
  /** 内置列不可删除 */
  builtin?: boolean
}

/** 选手 */
export interface Player {
  id: string
  name: string
  /** 击杀数 */
  kills: number
  /** 总积分 */
  score: number
  /** 自定义列数值 */
  stats: Record<string, number>
}

/** 全局赛事数据（在控制台与展示页之间实时同步） */
export interface MatchState {
  version: number
  /** 卡片主标题 */
  title: string
  /** 组别（如（A组）） */
  groupTag: string
  /** 卡片副标题小字 */
  subtitle: string
  /** 卡片最大宽度 (px)，表格按列宽比例自动填满 */
  maxWidth: number
  /** 当前选手（点击表格行选中，显示在卡片底栏） */
  currentPlayerId: string | null
  columns: ColumnConfig[]
  players: Player[]
}

export const BUILTIN_KEYS = ['rank', 'player', 'kills', 'score'] as const

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'rank', title: '排名', width: 60, minWidth: 50, builtin: true },
  { key: 'player', title: '选手', width: 110, minWidth: 80, builtin: true },
  { key: 'kills', title: '击杀数', width: 90, minWidth: 70, builtin: true },
  { key: 'score', title: '总积分', width: 90, minWidth: 70, builtin: true },
]

/** 默认状态 */
export function createDefaultState(): MatchState {
  return {
    version: 1,
    title: '小组赛积分表',
    groupTag: '（A组）',
    subtitle: 'YEXIUDIANFENGSAI XIAOZUSAi',
    maxWidth: 600,
    currentPlayerId: null,
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c })),
    players: [
      { id: crypto.randomUUID(), name: 'q.aaa', kills: 0, score: 0, stats: {} },
      { id: crypto.randomUUID(), name: '默', kills: 0, score: 0, stats: {} },
      { id: crypto.randomUUID(), name: '礼拜天', kills: 0, score: 0, stats: {} },
      { id: crypto.randomUUID(), name: 'Anj', kills: 0, score: 0, stats: {} },
      { id: crypto.randomUUID(), name: '忘川', kills: 0, score: 0, stats: {} },
      { id: crypto.randomUUID(), name: '昏', kills: 0, score: 0, stats: {} },
    ],
  }
}

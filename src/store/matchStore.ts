import { create } from 'zustand'
import type { ColumnConfig, MatchState, Player } from '../types'
import { createDefaultState } from '../types'
import { fetchRemoteState, pushRemoteState, subscribeRemoteState } from './supabaseSync'

const STORAGE_KEY = 'zb-table-state'
const CHANNEL_NAME = 'zb-table-sync'

/** 旧版本/缺失字段的数据做归一化，保证结构完整 */
function normalizeState(raw: unknown): MatchState {
  const base = createDefaultState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<MatchState>

  const columns: ColumnConfig[] =
    Array.isArray(r.columns) && r.columns.length > 0
      ? r.columns
          .map((c) => ({
            key: c?.key ?? '',
            title: c?.title ?? '',
            width: typeof c?.width === 'number' ? c.width : 90,
            minWidth: typeof c?.minWidth === 'number' ? c.minWidth : 70,
            builtin: !!c?.builtin,
          }))
          .filter((c) => c.key)
      : base.columns.map((c) => ({ ...c }))

  const players: Player[] = Array.isArray(r.players)
    ? r.players.map((p, i) => ({
        id: typeof p?.id === 'string' ? p.id : crypto.randomUUID(),
        name: typeof p?.name === 'string' ? p.name : `选手 ${i + 1}`,
        kills: typeof p?.kills === 'number' ? p.kills : 0,
        score: typeof p?.score === 'number' ? p.score : 0,
        stats: p?.stats && typeof p.stats === 'object' ? { ...p.stats } : {},
      }))
    : base.players.map((p) => ({ ...p }))

  // 当前选手必须存在于选手列表中，否则清空
  const currentPlayerId =
    typeof r.currentPlayerId === 'string' && players.some((p) => p.id === r.currentPlayerId)
      ? r.currentPlayerId
      : null

  return {
    version: typeof r.version === 'number' ? r.version : base.version,
    title: typeof r.title === 'string' ? r.title : base.title,
    groupTag: typeof r.groupTag === 'string' ? r.groupTag : base.groupTag,
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : base.subtitle,
    maxWidth: typeof r.maxWidth === 'number' ? r.maxWidth : base.maxWidth,
    currentPlayerId,
    columns,
    players,
  }
}

/** 从 localStorage 恢复，数据损坏时回退默认状态 */
function loadInitialState(): MatchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return createDefaultState()
}

interface MatchActions {
  /** 卡片信息（编辑页「确认更新」后应用） */
  setCardInfo: (
    patch: Partial<Pick<MatchState, 'title' | 'groupTag' | 'subtitle' | 'maxWidth'>>,
  ) => void
  /** 表头配置（编辑页「确认更新」后应用）：整体替换列配置 */
  setColumns: (columns: ColumnConfig[]) => void
  /** 列宽拖拽时批量更新（卡片上直接生效） */
  setColumnWidths: (widths: Record<string, number>) => void
  /** 选手数据（编辑页「确认更新」后应用）：整体替换选手列表 */
  setPlayers: (players: Player[]) => void
  /** 设置当前选手（传 null 取消选中） */
  setCurrentPlayer: (id: string | null) => void
  /** 应用其他标签页广播过来的状态（不再次广播，避免回环） */
  applyRemoteState: (state: MatchState) => void
}

/** 同机多标签页 / OBS 窗口之间实时同步的通道 */
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

export const useMatchStore = create<MatchState & MatchActions>()((set, get) => {
  /** 所有变更的统一出口：更新 state → 持久化 → 同机广播 → 远端推送 */
  const commit = (mutator: (s: MatchState) => MatchState) => {
    const next: MatchState = { ...mutator(get()), version: get().version + 1 }
    set(next)
    // zustand 的 state 里包含 action 函数，先序列化剔除函数，
    // 否则 BroadcastChannel 结构化克隆会抛 DataCloneError
    const snapshot: MatchState = JSON.parse(JSON.stringify(next)) as MatchState
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      /* 隐私模式等场景下忽略持久化失败 */
    }
    try {
      channel?.postMessage({ type: 'state', state: snapshot })
    } catch {
      /* 广播失败不阻断操作 */
    }
    pushRemoteState(snapshot)
  }

  return {
    ...loadInitialState(),

    setCardInfo: (patch) => commit((s) => ({ ...s, ...patch })),

    setColumns: (columns) =>
      commit((s) => {
        const keys = new Set(columns.map((c) => c.key))
        return {
          ...s,
          columns: columns.map((c) => ({ ...c })),
          players: s.players.map((p) => {
            const stats = { ...p.stats }
            // 新增列补默认值 0
            for (const c of columns) {
              if (!c.builtin && stats[c.key] === undefined) stats[c.key] = 0
            }
            // 已删除列清理数值
            for (const key of Object.keys(stats)) {
              if (!keys.has(key)) delete stats[key]
            }
            return { ...p, stats }
          }),
        }
      }),

    setColumnWidths: (widths) =>
      commit((s) => ({
        ...s,
        columns: s.columns.map((c) =>
          widths[c.key] !== undefined ? { ...c, width: Math.max(widths[c.key], c.minWidth) } : c,
        ),
      })),

    setPlayers: (players) =>
      commit((s) => {
        const copy = players.map((p) => ({ ...p, stats: { ...p.stats } }))
        return {
          ...s,
          players: copy,
          // 被删除的选手若是当前选手，则清除选中
          currentPlayerId: copy.some((p) => p.id === s.currentPlayerId)
            ? s.currentPlayerId
            : null,
        }
      }),

    setCurrentPlayer: (id) => commit((s) => ({ ...s, currentPlayerId: id })),

    /** 应用远端/同机广播的状态：写入本地并持久化（不广播、不推送，避免回环） */
    applyRemoteState: (state) => {
      set(state)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* ignore */
      }
    },
  }
})

channel?.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { type?: string; state?: MatchState }
  if (data?.type === 'state' && data.state) {
    useMatchStore.getState().applyRemoteState(data.state)
  }
})

/** 远端初始化：拉取最新状态 + 订阅实时变化，version 大于本地才应用 */
const applyRemoteIfNewer = (remote: MatchState | null) => {
  if (remote && remote.version > useMatchStore.getState().version) {
    useMatchStore.getState().applyRemoteState(remote)
  }
}

void fetchRemoteState().then(applyRemoteIfNewer)
subscribeRemoteState(applyRemoteIfNewer)

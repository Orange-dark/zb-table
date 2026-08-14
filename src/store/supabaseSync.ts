import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { MatchState } from '../types'

const TABLE = 'match_state'

type StateRow = { id: number; data: MatchState; updated_at: string }

let client: SupabaseClient | null = null

/**
 * 获取 Supabase 客户端。
 * 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 时返回 null，远端同步静默禁用。
 */
function getClient(): SupabaseClient | null {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  // 兼容面板复制的两种地址：项目 URL（https://xxx.supabase.co）或 REST URL（…/rest/v1）
  const baseUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
  client = createClient(baseUrl, key)
  return client
}

/** 拉取远端最新状态（无远端配置或未初始化时返回 null） */
export async function fetchRemoteState(): Promise<MatchState | null> {
  const c = getClient()
  if (!c) return null
  try {
    const { data, error } = await c
      .from(TABLE)
      .select('data')
      .eq('id', 1)
      .maybeSingle<{ data: MatchState }>()
    if (error || !data) return null
    return data.data
  } catch {
    return null
  }
}

/** 待推送的最新状态 + 400ms trailing debounce（列宽拖拽等高频 commit 合并推送） */
let pendingState: MatchState | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null

/** 推送状态到远端（fire-and-forget，网络失败静默） */
export function pushRemoteState(state: MatchState): void {
  if (!getClient()) return
  pendingState = state
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    const c = getClient()
    const next = pendingState
    pendingState = null
    if (!c || !next) return
    void c
      .from(TABLE)
      .upsert({ id: 1, data: next, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.warn('[supabase] push failed:', error.message)
      })
  }, 400)
}

/** 订阅远端变化，返回取消订阅函数 */
export function subscribeRemoteState(onState: (state: MatchState) => void): () => void {
  const c = getClient()
  if (!c) return () => {}

  const handle = (payload: RealtimePostgresChangesPayload<StateRow>) => {
    const data = (payload.new as StateRow | null)?.data
    if (data) onState(data)
  }

  const channel = c
    .channel('match-state-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, handle)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE }, handle)
    .subscribe()

  return () => {
    void c.removeChannel(channel)
  }
}

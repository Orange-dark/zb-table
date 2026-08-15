import { useEffect, useState } from 'react'
import { useMatchStore } from '../store/matchStore'
import type { ColumnConfig, Player } from '../types'
import ScoreCard from './ScoreCard'
import '../styles/editor.css'

/**
 * 编辑页：上方为直播比分卡片（实时预览），下方为数据/表头控制表格。
 * 三个配置区均在本地草稿中编辑，点击「确认更新」后才应用到卡片并同步展示页。
 */
export default function ScoreBoard() {
  const {
    title,
    groupTag,
    subtitle,
    maxWidth,
    columns,
    players,
    currentPlayerId,
    setCardInfo,
    setColumns,
    setPlayers,
  } = useMatchStore()

  /** 卡片信息草稿 */
  const [cardDraft, setCardDraft] = useState({ title, groupTag, subtitle, maxWidth })
  /** 表头配置草稿 */
  const [columnsDraft, setColumnsDraft] = useState<ColumnConfig[]>(columns)
  /** 选手数据草稿 */
  const [playersDraft, setPlayersDraft] = useState<Player[]>(players)
  /** 当前选手草稿（单选框，随「确认更新」一起应用） */
  const [currentPlayerIdDraft, setCurrentPlayerIdDraft] = useState<string | null>(currentPlayerId)
  /** 用户是否已开始编辑草稿；编辑后草稿不再跟随远端数据 */
  const [draftsTouched, setDraftsTouched] = useState(false)
  const touchDrafts = () => setDraftsTouched(true)

  /** 卡片上点击选中 / 远端同步改变当前选手时，同步到草稿单选框 */
  useEffect(() => {
    setCurrentPlayerIdDraft(currentPlayerId)
  }, [currentPlayerId])

  /**
   * 首次进入页面时把远端数据填入草稿（用户开始编辑前会持续跟随 store，
   * 一旦 draftsTouched 变为 true 就不再同步，草稿只由用户本地控制）。
   */
  useEffect(() => {
    if (draftsTouched) return
    setCardDraft({ title, groupTag, subtitle, maxWidth })
    setColumnsDraft(columns)
    setPlayersDraft(players)
    setCurrentPlayerIdDraft(currentPlayerId)
  }, [title, groupTag, subtitle, maxWidth, columns, players, currentPlayerId, draftsTouched])

  /** 按总积分计算当前排名（基于草稿） */
  const rankOf = (playerId: string) => {
    const sorted = [...playersDraft].sort((a, b) => b.score - a.score)
    return sorted.findIndex((p) => p.id === playerId) + 1
  }

  /** 数据表格展示的列：除 rank（排名单独渲染）外的所有列（基于草稿） */
  const dataColumns = columnsDraft.filter((c) => c.key !== 'rank' && c.key !== 'player')

  // ===== 表头草稿操作 =====
  const addColumnDraft = () => {
    touchDrafts()
    setColumnsDraft((d) => [
      ...d,
      {
        key: crypto.randomUUID(),
        title: `新列 ${d.filter((c) => !c.builtin).length + 1}`,
        width: 90,
        minWidth: 70,
      },
    ])
  }
  const removeColumnDraft = (key: string) => {
    touchDrafts()
    setColumnsDraft((d) => d.filter((c) => c.key !== key))
  }
  const renameColumnDraft = (key: string, title: string) => {
    touchDrafts()
    setColumnsDraft((d) => d.map((c) => (c.key === key ? { ...c, title } : c)))
  }
  const changeColumnWidthDraft = (key: string, width: number) => {
    touchDrafts()
    setColumnsDraft((d) =>
      d.map((c) => (c.key === key ? { ...c, width: Math.max(width, c.minWidth) } : c)),
    )
  }

  // ===== 选手草稿操作 =====
  const addPlayerDraft = () => {
    touchDrafts()
    setPlayersDraft((d) => [
      ...d,
      { id: crypto.randomUUID(), name: `选手 ${d.length + 1}`, kills: 0, score: 0, stats: {} },
    ])
  }
  const removePlayerDraft = (id: string, name: string) => {
    if (window.confirm(`确定删除选手「${name}」吗？`)) {
      touchDrafts()
      setPlayersDraft((d) => d.filter((p) => p.id !== id))
      if (currentPlayerIdDraft === id) setCurrentPlayerIdDraft(null)
    }
  }
  const updatePlayerDraft = (
    id: string,
    patch: Partial<Pick<Player, 'name' | 'kills' | 'score'>>,
  ) => {
    touchDrafts()
    setPlayersDraft((d) => d.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  const setStatDraft = (id: string, key: string, value: number) => {
    touchDrafts()
    setPlayersDraft((d) =>
      d.map((p) => (p.id === id ? { ...p, stats: { ...p.stats, [key]: value } } : p)),
    )
  }

  return (
    <div className="editor-page">
      {/* 上方：比分卡片（实时预览，样式即直播画面） */}
      <ScoreCard />

      {/* 下方：控制表格 */}
      <section className="editor-section">
        <div className="editor-hint">
          💡 各配置区编辑后需点「确认更新」才会应用到卡片并同步展示页{' '}
          <code>/scoreboard</code>
        </div>

        {/* 卡片信息 */}
        <div className="editor-card">
          <h2 className="editor-card-title">卡片信息</h2>
          <div className="editor-fields">
            <label>
              主标题
              <input
                value={cardDraft.title}
                onChange={(e) => {
                  touchDrafts()
                  setCardDraft((d) => ({ ...d, title: e.target.value }))
                }}
              />
            </label>
            <label>
              组别
              <input
                value={cardDraft.groupTag}
                onChange={(e) => {
                  touchDrafts()
                  setCardDraft((d) => ({ ...d, groupTag: e.target.value }))
                }}
              />
            </label>
            <label>
              副标题
              <input
                value={cardDraft.subtitle}
                onChange={(e) => {
                  touchDrafts()
                  setCardDraft((d) => ({ ...d, subtitle: e.target.value }))
                }}
              />
            </label>
            <label>
              卡片最大宽度 (px)
              <input
                type="number"
                min={280}
                value={cardDraft.maxWidth}
                onChange={(e) => {
                  touchDrafts()
                  setCardDraft((d) => ({ ...d, maxWidth: Number(e.target.value) || 600 }))
                }}
              />
            </label>
          </div>
          <div className="editor-actions editor-actions-end">
            <button
              className="btn-secondary"
              onClick={() => {
                touchDrafts()
                setCardDraft({ title, groupTag, subtitle, maxWidth })
              }}
            >
              取消
            </button>
            <button className="btn-primary" onClick={() => setCardInfo(cardDraft)}>
              确认更新
            </button>
          </div>
        </div>

        {/* 表头（列）配置 */}
        <div className="editor-card">
          <h2 className="editor-card-title">表头配置</h2>
          <table className="editor-table">
            <thead>
              <tr>
                <th>列名</th>
                <th>宽度 (px)</th>
                <th>类型</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {columnsDraft.map((col) => (
                <tr key={col.key}>
                  <td>
                    <input
                      value={col.title}
                      onChange={(e) => renameColumnDraft(col.key, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={col.minWidth}
                      value={col.width}
                      onChange={(e) =>
                        changeColumnWidthDraft(col.key, Number(e.target.value) || col.minWidth)
                      }
                    />
                  </td>
                  <td>
                    <span className="badge">{col.builtin ? '内置' : '自定义'}</span>
                  </td>
                  <td>
                    {col.builtin ? (
                      <span className="muted">—</span>
                    ) : (
                      <button
                        className="btn-danger"
                        onClick={() => removeColumnDraft(col.key)}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="editor-actions">
            <button className="btn-primary" onClick={addColumnDraft}>
              ＋ 添加列
            </button>
            <div className="editor-actions-right">
              <button
                className="btn-secondary"
                onClick={() => {
                  touchDrafts()
                  setColumnsDraft(columns)
                }}
              >
                取消
              </button>
              <button className="btn-primary" onClick={() => setColumns(columnsDraft)}>
                确认更新
              </button>
            </div>
          </div>
        </div>

        {/* 选手数据（增删改查） */}
        <div className="editor-card">
          <h2 className="editor-card-title">选手数据</h2>
          <table className="editor-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>选手</th>
                <th>当前选手</th>
                {dataColumns.map((c) => (
                  <th key={c.key}>{c.title}</th>
                ))}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {playersDraft.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="badge">{rankOf(p.id)}</span>
                  </td>
                  <td>
                    <input
                      value={p.name}
                      onChange={(e) => updatePlayerDraft(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="radio-cell">
                    <input
                      type="radio"
                      name="current-player"
                      checked={p.id === currentPlayerIdDraft}
                      onChange={() => {
                        touchDrafts()
                        setCurrentPlayerIdDraft(p.id)
                      }}
                    />
                  </td>
                  {dataColumns.map((col) => {
                    if (col.key === 'kills') {
                      return (
                        <td key={col.key}>
                          <input
                            type="number"
                            value={p.kills}
                            onChange={(e) =>
                              updatePlayerDraft(p.id, { kills: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                      )
                    }
                    if (col.key === 'score') {
                      return (
                        <td key={col.key}>
                          <input
                            type="number"
                            value={p.score}
                            onChange={(e) =>
                              updatePlayerDraft(p.id, { score: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                      )
                    }
                    return (
                      <td key={col.key}>
                        <input
                          type="number"
                          value={p.stats[col.key] ?? 0}
                          onChange={(e) =>
                            setStatDraft(p.id, col.key, Number(e.target.value) || 0)
                          }
                        />
                      </td>
                    )
                  })}
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => removePlayerDraft(p.id, p.name)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="editor-actions">
            <button className="btn-primary" onClick={addPlayerDraft}>
              ＋ 添加选手
            </button>
            <div className="editor-actions-right">
              <button
                className="btn-secondary"
                onClick={() => {
                  touchDrafts()
                  setPlayersDraft(players)
                  setCurrentPlayerIdDraft(currentPlayerId)
                }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={() => setPlayers(playersDraft, currentPlayerIdDraft)}
              >
                确认更新
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

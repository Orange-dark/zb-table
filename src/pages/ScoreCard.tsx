import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { motion } from 'framer-motion'
import { useMatchStore } from '../store/matchStore'
import '../styles/scorecard.css'

interface ResizeState {
  startX: number
  currentKey: string
  nextKey: string
  currentWidth: number
  nextWidth: number
}

/**
 * 直播比分卡片（积分表）
 * 红色卡片样式 + 可拖拽列宽，数据来自全局 store，实时同步
 */
export default function ScoreCard() {
  const { title, groupTag, subtitle, maxWidth, columns, players, currentPlayerId, setCurrentPlayer } =
    useMatchStore()
  const resizingRef = useRef<ResizeState | null>(null)

  const sorted = [...players].sort((a, b) => b.score - a.score)
  /** 各列按基准宽度占比（fr）分配，表格自动填满卡片宽度 */
  const gridTemplateColumns = columns.map((c) => `${c.width}fr`).join(' ')

  const currentPlayer = players.find((p) => p.id === currentPlayerId)

  /** 点击选手行：选中/取消当前选手 */
  const handleRowClick = (playerId: string) => {
    setCurrentPlayer(currentPlayerId === playerId ? null : playerId)
  }

  /** 开始调整列宽：当前列变宽多少，下一列就变窄多少，总宽度不变 */
  const startResize = (event: ReactMouseEvent, columnIndex: number) => {
    event.preventDefault()
    event.stopPropagation()

    const currentColumn = columns[columnIndex]
    const nextColumn = columns[columnIndex + 1]
    // 最后一列不需要拖动
    if (!nextColumn) return

    resizingRef.current = {
      startX: event.clientX,
      currentKey: currentColumn.key,
      nextKey: nextColumn.key,
      currentWidth: currentColumn.width,
      nextWidth: nextColumn.width,
    }

    document.body.classList.add('resizing')
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
  }

  const handleResize = (event: MouseEvent) => {
    const resizing = resizingRef.current
    if (!resizing) return

    const { startX, currentKey, nextKey, currentWidth, nextWidth } = resizing
    const delta = event.clientX - startX

    const store = useMatchStore.getState()
    const currentColumn = store.columns.find((c) => c.key === currentKey)
    const nextColumn = store.columns.find((c) => c.key === nextKey)
    if (!currentColumn || !nextColumn) return

    // 卡片实际渲染时按比例缩放，拖拽增量需除以缩放系数，保证鼠标 1:1 手感
    const totalWidth = store.columns.reduce((a, c) => a + c.width, 0)
    const scale = totalWidth > 0 ? store.maxWidth / totalWidth : 1
    const deltaWidth = delta / scale

    let newCurrentWidth = currentWidth + deltaWidth
    let newNextWidth = nextWidth - deltaWidth

    // 限制最小宽度
    if (newCurrentWidth < currentColumn.minWidth) {
      const diff = currentColumn.minWidth - newCurrentWidth
      newCurrentWidth = currentColumn.minWidth
      newNextWidth -= diff
    }
    if (newNextWidth < nextColumn.minWidth) {
      const diff = nextColumn.minWidth - newNextWidth
      newNextWidth = nextColumn.minWidth
      newCurrentWidth -= diff
    }
    if (newCurrentWidth < currentColumn.minWidth || newNextWidth < nextColumn.minWidth) {
      return
    }

    useMatchStore.getState().setColumnWidths({
      [currentKey]: newCurrentWidth,
      [nextKey]: newNextWidth,
    })
  }

  const stopResize = () => {
    resizingRef.current = null
    document.body.classList.remove('resizing')
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }

  // 组件卸载时清理全局监听
  useEffect(() => stopResize, [])

  return (
    <div className="score-page">
      <div className="score-card" style={{ maxWidth: `${maxWidth}px` }}>
        {/* 标题 */}
        <div className="score-header">
          <div className="score-title">
            {title}
            <span>{groupTag}</span>
          </div>
          <div className="score-subtitle">{subtitle}</div>
        </div>

        {/* 表格 */}
        <div className="score-table-wrapper">
          <div
            className="score-table"
            style={{ minWidth: `${columns.reduce((a, c) => a + c.minWidth, 0)}px` }}
          >
            {/* 表头 */}
            <div className="score-row score-head" style={{ gridTemplateColumns }}>
              {columns.map((column, index) => (
                <div className="score-cell" key={column.key}>
                  <span>{column.title}</span>
                  {/* 拖动条 */}
                  {index < columns.length - 1 && (
                    <div
                      className="resize-handle"
                      onMouseDown={(event) => startResize(event, index)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 数据（按总积分降序） */}
            {sorted.map((player, index) => (
              <div
                className="score-row score-data-row"
                key={player.id}
                style={{ gridTemplateColumns }}
                title="点击设为当前选手"
                onClick={() => handleRowClick(player.id)}
              >
                {columns.map((column) => {
                  const cls =
                    column.key === 'rank'
                      ? 'score-cell rank-cell'
                      : column.key === 'player'
                        ? 'score-cell player-cell'
                        : 'score-cell'
                  return (
                    <div className={cls} key={column.key}>
                      {column.key === 'rank' && (
                        <span className="rank-number">{index + 1}</span>
                      )}
                      {column.key === 'player' && player.name}
                      {column.key === 'kills' && player.kills}
                      {column.key === 'score' && (
                        <motion.span
                          key={player.score}
                          className="score-pop"
                          initial={{ scale: 1.45 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        >
                          {player.score}
                        </motion.span>
                      )}
                      {!['rank', 'player', 'kills', 'score'].includes(column.key) &&
                        (player.stats[column.key] ?? 0)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 当前选手 */}
        <div className="current-player">
          <span>当前选手</span>
          {currentPlayer && <span className="current-player-name">{currentPlayer.name}</span>}
        </div>
      </div>
    </div>
  )
}

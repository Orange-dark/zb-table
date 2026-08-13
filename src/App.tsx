import { Routes, Route } from 'react-router-dom'
import ScoreBoard from './pages/ScoreBoard'
import ScoreCard from './pages/ScoreCard'

export default function App() {
  return (
    <Routes>
      {/* 编辑页：卡片预览 + 下方数据/表头控制表格 */}
      <Route path="/" element={<ScoreBoard />} />
      {/* 纯展示页：仅比分卡片，供 OBS 捕获 */}
      <Route path="/scoreboard" element={<ScoreCard />} />
    </Routes>
  )
}

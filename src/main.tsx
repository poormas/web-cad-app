import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 注意：刻意不使用 <StrictMode>。
// react-konva 与 StrictMode 的开发期双重挂载不兼容：Stage 渲染正常，
// 但 Konva 鼠标/滚轮事件全部失效（症状即「画布显示正常、点击无反应」）。
// 移除 StrictMode 后事件恢复正常。
createRoot(document.getElementById('root')!).render(<App />)

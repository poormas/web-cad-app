import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useEditorStore } from '../../core/state/useEditorStore'

/**
 * 微型命令输入框（类 AutoCAD 命令行）：
 * 画线/画圆草图中直接键入数字（0-9 .）即弹出，
 * Enter 确认——画线按当前光标方向生成定长线段、画圆按半径落盘；Esc 取消。
 */
export default function CommandPrompt() {
  const commandValue = useEditorStore(s => s.commandValue)
  const setCommandValue = useEditorStore(s => s.setCommandValue)
  if (commandValue === null) return null

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const v = parseFloat(commandValue)
      if (Number.isFinite(v) && v > 0) useEditorStore.getState().applyCommandValue(v)
      else setCommandValue(null)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setCommandValue(null)
    }
  }

  return (
    <div className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-400/40 bg-slate-900/85 px-3 py-1.5 shadow-2xl backdrop-blur-md">
      <span className="text-xs text-blue-300">长度 / 半径</span>
      <input
        autoFocus
        value={commandValue}
        onChange={e => setCommandValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setCommandValue(null)}
        className="w-28 bg-transparent font-mono text-sm text-blue-100 outline-none placeholder:text-slate-500"
        placeholder="键入数值"
      />
      <span className="text-[10px] text-slate-500">Enter 确认 · Esc 取消</span>
    </div>
  )
}

import {
  Circle,
  Copy,
  FlipHorizontal2,
  Gauge,
  Hand,
  MousePointer2,
  Move,
  Redo2,
  RotateCw,
  Rows2,
  Ruler,
  Scissors,
  Slash,
  Square,
  Undo2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEditorStore, type Tool } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'

const SELECT_TOOLS: ReadonlyArray<{ id: Tool; label: string; icon: LucideIcon }> = [
  { id: 'select', label: '选择（框选：左→右窗口 / 右→左交叉）', icon: MousePointer2 },
  { id: 'pan', label: '抓手平移', icon: Hand },
]

const DRAW_TOOLS: ReadonlyArray<{ id: Tool; label: string; icon: LucideIcon }> = [
  { id: 'line', label: '直线', icon: Slash },
  { id: 'rect', label: '矩形', icon: Square },
  { id: 'circle', label: '圆', icon: Circle },
  { id: 'dimension', label: '线性标注', icon: Ruler },
  { id: 'measure', label: '距离测量', icon: Gauge },
]

const EDIT_TOOLS: ReadonlyArray<{ id: Tool; label: string; icon: LucideIcon }> = [
  { id: 'move', label: '移动（基准点 → 目标点）', icon: Move },
  { id: 'copy', label: '复制（基准点 → 目标点）', icon: Copy },
  { id: 'rotate', label: '旋转（基准点 + 角度）', icon: RotateCw },
  { id: 'trim', label: '修剪（点击多余线头一侧）', icon: Scissors },
  { id: 'mirror', label: '镜像（两点确定对称轴）', icon: FlipHorizontal2 },
  { id: 'offset', label: '偏移（点击实体一侧）', icon: Rows2 },
]

const btnBase = 'flex h-9 w-9 items-center justify-center rounded-lg transition-colors'
const historyBtn = `${btnBase} text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`
const divider = <div className="mx-1 h-px bg-white/10" />

/** 左侧悬浮工具栏：撤销/重做 + 选择/平移 + 绘图 + 编辑命令（毛玻璃深色面板） */
export default function ToolBar() {
  const activeTool = useEditorStore(s => s.activeTool)
  const setActiveTool = useEditorStore(s => s.setActiveTool)
  const mirrorKeepOriginal = useEditorStore(s => s.mirrorKeepOriginal)
  const toggleMirrorKeepOriginal = useEditorStore(s => s.toggleMirrorKeepOriginal)
  const offsetDistance = useEditorStore(s => s.offsetDistance)
  const setOffsetDistance = useEditorStore(s => s.setOffsetDistance)
  const canUndo = useEntityStore(s => s.past.length > 0)
  const canRedo = useEntityStore(s => s.future.length > 0)
  const undo = useEntityStore(s => s.undo)
  const redo = useEntityStore(s => s.redo)

  const toolButton = ({ id, label, icon: Icon }: { id: Tool; label: string; icon: LucideIcon }) => {
    const active = activeTool === id
    return (
      <button
        key={id}
        type="button"
        title={label}
        aria-pressed={active}
        onClick={() => setActiveTool(id)}
        className={`${btnBase} ${
          active
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon size={18} />
      </button>
    )
  }

  return (
    <div className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-slate-900/60 p-1.5 shadow-2xl backdrop-blur-md">
      {/* 撤销 / 重做：无历史时置灰 */}
      <button type="button" title="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={undo} className={historyBtn}>
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
        className={historyBtn}
      >
        <Redo2 size={18} />
      </button>
      {divider}
      {/* 选择与平移 */}
      {SELECT_TOOLS.map(toolButton)}
      {divider}
      {/* 绘图与标注 */}
      {DRAW_TOOLS.map(toolButton)}
      {divider}
      {/* 编辑命令 */}
      {EDIT_TOOLS.map(toolButton)}
      {/* 镜像：是否保留原对象 */}
      {activeTool === 'mirror' && (
        <button
          type="button"
          title="镜像后保留原对象（勾选状态切换）"
          aria-pressed={mirrorKeepOriginal}
          onClick={toggleMirrorKeepOriginal}
          className={`flex items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] transition-colors ${
            mirrorKeepOriginal
              ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
              : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
          }`}
        >
          <Copy size={12} />
          保留原件
        </button>
      )}
      {/* 偏移：距离输入 */}
      {activeTool === 'offset' && (
        <label
          title="偏移距离（世界单位）"
          className="flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-slate-400"
        >
          偏移
          <input
            type="number"
            min={0.05}
            step={0.5}
            value={offsetDistance}
            onChange={e => {
              const v = parseFloat(e.target.value)
              if (Number.isFinite(v) && v > 0) setOffsetDistance(v)
            }}
            className="w-12 bg-transparent font-mono text-xs text-slate-200 outline-none"
          />
        </label>
      )}
    </div>
  )
}

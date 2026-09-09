import { Grid3x3, Magnet, Maximize } from 'lucide-react'
import { INITIAL_SCALE, useEditorStore } from '../../core/state/useEditorStore'

const toggleCls = (on: boolean) =>
  `flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors ${
    on
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
  }`

/** 底部状态条：实时世界坐标、对象捕捉/正交模式开关、缩放百分比、适应视图按钮 */
export default function StatusBar() {
  const cursorWorld = useEditorStore(s => s.cursorWorld)
  const scale = useEditorStore(s => s.view.scale)
  const snapEnabled = useEditorStore(s => s.snapEnabled)
  const toggleSnapEnabled = useEditorStore(s => s.toggleSnapEnabled)
  const ortho = useEditorStore(s => s.ortho)
  const toggleOrtho = useEditorStore(s => s.toggleOrtho)
  const fitView = useEditorStore(s => s.fitView)

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-white/10 bg-slate-900/70 px-4 py-1.5 font-mono text-xs text-slate-300 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span>
          X <span className="text-slate-100">{cursorWorld ? cursorWorld.x.toFixed(2) : '--'}</span>
        </span>
        <span>
          Y <span className="text-slate-100">{cursorWorld ? cursorWorld.y.toFixed(2) : '--'}</span>
        </span>
        {/* 对象捕捉（OSNAP）开关 */}
        <button
          type="button"
          title="对象捕捉 OSNAP (F3)"
          onClick={toggleSnapEnabled}
          className={toggleCls(snapEnabled)}
        >
          <Magnet size={13} />
          对象捕捉 {snapEnabled ? '开' : '关'}
        </button>
        {/* 正交模式（ORTHO）开关 */}
        <button
          type="button"
          title="正交模式 ORTHO (F8；按住 Shift 可临时反转)"
          onClick={toggleOrtho}
          className={toggleCls(ortho)}
        >
          <Grid3x3 size={13} />
          正交 {ortho ? '开' : '关'}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span>
          缩放 <span className="text-slate-100">{Math.round((scale / INITIAL_SCALE) * 100)}%</span>
        </span>
        <button
          type="button"
          onClick={fitView}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Maximize size={13} />
          适应视图
        </button>
      </div>
    </div>
  )
}

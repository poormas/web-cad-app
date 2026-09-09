import { useState } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Lock,
  LockOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEditorStore } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'
import { useLayerStore } from '../../core/state/useLayerStore'

const ENTITY_NAMES = {
  line: '直线',
  rect: '矩形',
  circle: '圆',
  polyline: '多段线',
  dimension: '线性标注',
} as const

/**
 * 右侧多图层与实体属性面板（毛玻璃深色风格，支持收起/展开）：
 * - 图层列表：激活单选标记、颜色圆点（点击打开取色器）、显隐、锁定、删除；
 * - 选中实体（支持多选）：显示类型/数量，支持批量移动图层、批量改色。
 */
export default function LayerPanel() {
  const [open, setOpen] = useState(true)
  const layers = useLayerStore(s => s.layers)
  const activeLayerId = useLayerStore(s => s.activeLayerId)
  const addLayer = useLayerStore(s => s.addLayer)
  const removeLayer = useLayerStore(s => s.removeLayer)
  const toggleVisible = useLayerStore(s => s.toggleVisible)
  const toggleLocked = useLayerStore(s => s.toggleLocked)
  const updateLayerColor = useLayerStore(s => s.updateLayerColor)
  const setActiveLayer = useLayerStore(s => s.setActiveLayer)
  const selectedIds = useEditorStore(s => s.selectedIds)
  // 细粒度订阅：selector 只取稳定的 entities 引用（引用仅在实体增删改时变化），
  // 派生过滤结果放在组件体内计算——严禁在 selector 中 filter 返回新数组（会触发 getSnapshot 无限循环）
  const entities = useEntityStore(s => s.entities)
  const selectedEntities =
    selectedIds.length > 0 ? entities.filter(e => selectedIds.includes(e.id)) : []

  if (!open) {
    return (
      <button
        type="button"
        title="展开图层面板"
        onClick={() => setOpen(true)}
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-slate-300 shadow-2xl backdrop-blur-md hover:text-white"
      >
        <Layers size={18} />
      </button>
    )
  }

  const first = selectedEntities[0]
  const firstLayer = first ? (layers.find(l => l.id === first.layerId) ?? layers[0]) : null
  const sharedLayerId =
    first && selectedEntities.every(e => e.layerId === first.layerId) ? first.layerId : ''
  const displayColor = first ? (first.color ?? firstLayer!.color) : '#ffffff'

  return (
    <div className="absolute right-4 top-1/2 z-10 w-60 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-900/70 p-3 shadow-2xl backdrop-blur-md">
      {/* 头部 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">图层</span>
        <button
          type="button"
          title="收起面板"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 新建图层 */}
      <button
        type="button"
        onClick={addLayer}
        className="mb-2 flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 py-1 text-xs text-slate-200 transition-colors hover:bg-white/10"
      >
        <Plus size={13} />
        新建图层
      </button>

      {/* 图层列表 */}
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {layers.map(layer => {
          const active = layer.id === activeLayerId
          return (
            <div
              key={layer.id}
              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${
                active ? 'bg-blue-500/15 ring-1 ring-blue-400/30' : 'hover:bg-white/5'
              }`}
            >
              {/* 当前激活单选标记 */}
              <button
                type="button"
                title="设为当前图层"
                onClick={() => setActiveLayer(layer.id)}
                className="flex h-4 w-4 shrink-0 items-center justify-center"
              >
                <span
                  className={`h-2 w-2 rounded-full ${active ? 'bg-blue-400' : 'bg-slate-600'}`}
                />
              </button>
              {/* 颜色圆点（点击打开取色器） */}
              <label title="修改图层颜色" className="relative h-3.5 w-3.5 shrink-0 cursor-pointer">
                <input
                  type="color"
                  value={layer.color}
                  onChange={e => updateLayerColor(layer.id, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  className="block h-3.5 w-3.5 rounded-full border border-white/30"
                  style={{ backgroundColor: layer.color }}
                />
              </label>
              {/* 名称（点击设为当前图层） */}
              <button
                type="button"
                title={`设为当前图层：${layer.name}`}
                onClick={() => setActiveLayer(layer.id)}
                className={`min-w-0 flex-1 truncate text-left text-xs ${
                  active ? 'text-slate-100' : 'text-slate-300'
                }`}
              >
                {layer.name}
              </button>
              {/* 显隐切换 */}
              <button
                type="button"
                title={layer.visible ? '隐藏图层' : '显示图层'}
                onClick={() => toggleVisible(layer.id)}
                className={`shrink-0 hover:text-white ${layer.visible ? 'text-slate-300' : 'text-slate-500'}`}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              {/* 锁定切换 */}
              <button
                type="button"
                title={layer.locked ? '解锁图层' : '锁定图层'}
                onClick={() => toggleLocked(layer.id)}
                className={`shrink-0 hover:text-white ${layer.locked ? 'text-amber-400' : 'text-slate-300'}`}
              >
                {layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
              {/* 删除（默认图层不可删） */}
              <button
                type="button"
                title={layer.id === '0' ? '默认图层不可删除' : '删除图层（图元将移至 0 层）'}
                disabled={layer.id === '0'}
                onClick={() => removeLayer(layer.id)}
                className="shrink-0 text-slate-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* 选中实体属性（支持多选批量操作） */}
      <div className="mt-3 border-t border-white/10 pt-2">
        <span className="text-xs text-slate-400">选中实体</span>
        {selectedEntities.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">未选中实体</p>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5 text-xs">
            <span className="text-slate-300">
              {selectedEntities.length === 1
                ? ENTITY_NAMES[selectedEntities[0].type]
                : `已选中 ${selectedEntities.length} 个实体`}
            </span>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-slate-400">图层</span>
              <select
                value={sharedLayerId}
                onChange={e =>
                  useEntityStore.getState().moveEntitiesToLayer(selectedIds, e.target.value)
                }
                className="min-w-0 flex-1 rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-slate-200 outline-none focus:border-blue-400/50"
                title="批量移动实体到其他图层"
              >
                {layers.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-slate-400">颜色</span>
              <label
                title="批量修改实体颜色（显式覆盖图层颜色）"
                className="relative h-4 flex-1 cursor-pointer"
              >
                <input
                  type="color"
                  value={displayColor}
                  onChange={e =>
                    useEntityStore.getState().updateEntitiesColor(selectedIds, e.target.value)
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  className="block h-4 w-full rounded border border-white/20"
                  style={{ backgroundColor: displayColor }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

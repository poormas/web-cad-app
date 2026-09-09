import { create } from 'zustand'
import { DEFAULT_LAYER, sanitizeLayers, type Layer } from '../../types/layer'
import { useEntityStore } from './useEntityStore'

/** 新建图层的循环配色 */
const NEW_LAYER_COLORS = ['#60a5fa', '#f87171', '#4ade80', '#facc15', '#c084fc', '#fb923c']

interface LayerState {
  /** 图层列表（'0' 层恒为首位且不可删除） */
  layers: Layer[]
  /** 当前激活图层 id：新绘制的实体继承此图层 */
  activeLayerId: string

  /** 新建图层（自动成为当前图层） */
  addLayer: () => void
  /** 删除非默认图层；其上的图元自动移至 '0' 层（并入一次撤销历史） */
  removeLayer: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  updateLayerColor: (id: string, color: string) => void
  setActiveLayer: (id: string) => void
  /** 整体载入图层列表（工程文件导入；清洗并确保存在 '0' 层） */
  loadLayers: (layers: Layer[], activeLayerId?: string) => void
  /** 重置为仅默认 '0' 层（新建工程） */
  resetLayers: () => void
  /** 合并外部图层（DXF 导入；已存在的 id 不覆盖，当前图层不变） */
  mergeLayers: (layers: Layer[]) => void
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [DEFAULT_LAYER],
  activeLayerId: DEFAULT_LAYER.id,

  addLayer: () => {
    const { layers } = get()
    const layer: Layer = {
      id: crypto.randomUUID(),
      name: `图层 ${layers.length + 1}`,
      color: NEW_LAYER_COLORS[layers.length % NEW_LAYER_COLORS.length],
      strokeWidth: 2,
      visible: true,
      locked: false,
    }
    set({ layers: [...layers, layer], activeLayerId: layer.id })
  },

  removeLayer: (id) => {
    if (id === DEFAULT_LAYER.id) return
    const { layers, activeLayerId } = get()
    if (!layers.some((l) => l.id === id)) return
    // 该图层上的图元移回 '0' 层（并入一次撤销历史）
    const entities = useEntityStore.getState().entities
    if (entities.some((e) => e.layerId === id)) {
      useEntityStore
        .getState()
        .commit(entities.map((e) => (e.layerId === id ? { ...e, layerId: DEFAULT_LAYER.id } : e)))
    }
    set({
      layers: layers.filter((l) => l.id !== id),
      activeLayerId: activeLayerId === id ? DEFAULT_LAYER.id : activeLayerId,
    })
  },

  toggleVisible: (id) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) }),

  toggleLocked: (id) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)) }),

  updateLayerColor: (id, color) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, color } : l)) }),

  setActiveLayer: (activeLayerId) => {
    if (get().layers.some((l) => l.id === activeLayerId)) set({ activeLayerId })
  },

  loadLayers: (layers, activeLayerId) => {
    const sanitized = sanitizeLayers(layers)
    const active = sanitized.some((l) => l.id === activeLayerId)
      ? activeLayerId!
      : DEFAULT_LAYER.id
    set({ layers: sanitized, activeLayerId: active })
  },

  resetLayers: () => set({ layers: [{ ...DEFAULT_LAYER }], activeLayerId: DEFAULT_LAYER.id }),

  mergeLayers: (incoming) => {
    const existing = get().layers
    const fresh = incoming.filter((l) => !existing.some((x) => x.id === l.id))
    if (fresh.length === 0) return
    set({ layers: [...existing, ...fresh] })
  },
}))

import { create } from 'zustand'
import type { Entity } from '../../types/entity'

/** 撤销历史最大步数 */
const MAX_HISTORY = 50

interface EntityState {
  /** 已确认实体列表（渲染顺序即创建顺序） */
  entities: Entity[]
  /** 撤销历史快照（旧 → 新，不含当前状态） */
  past: Entity[][]
  /** 重做历史快照（新 → 旧，即撤销顺序的逆序） */
  future: Entity[][]

  /** 追加新实体并推入撤销历史（图元创建完成时调用；一次调用 = 一步历史） */
  addEntities: (entities: Entity[]) => void
  /** 替换单个实体并推入一次撤销历史（拖拽移动落盘等） */
  replaceEntity: (id: string, next: Entity) => void
  /** 批量删除实体并推入一次撤销历史 */
  removeEntities: (ids: string[]) => void
  /** 将实体移动到其他图层并推入一次撤销历史 */
  moveEntityToLayer: (id: string, layerId: string) => void
  /** 批量将实体移动到其他图层（一次撤销历史） */
  moveEntitiesToLayer: (ids: string[], layerId: string) => void
  /** 批量修改实体显式颜色（一次撤销历史；覆盖图层颜色） */
  updateEntitiesColor: (ids: string[], color: string) => void
  /** 整体载入实体列表（工程文件 / DXF 导入；并入一次撤销历史） */
  loadEntities: (entities: Entity[]) => void
  /** 通用提交：以新实体列表替换当前列表并推入历史（后续批量操作复用） */
  commit: (next: Entity[]) => void
  undo: () => void
  redo: () => void
}

export const useEntityStore = create<EntityState>((set, get) => ({
  entities: [],
  past: [],
  future: [],

  addEntities: (entities) => {
    if (entities.length === 0) return
    get().commit([...get().entities, ...entities])
  },

  replaceEntity: (id, next) => {
    const { entities } = get()
    if (!entities.some((e) => e.id === id)) return
    get().commit(entities.map((e) => (e.id === id ? next : e)))
  },

  removeEntities: (ids) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    get().commit(get().entities.filter((e) => !idSet.has(e.id)))
  },

  moveEntityToLayer: (id, layerId) => {
    const { entities } = get()
    const target = entities.find((e) => e.id === id)
    if (!target || target.layerId === layerId) return
    get().commit(entities.map((e) => (e.id === id ? { ...e, layerId } : e)))
  },

  moveEntitiesToLayer: (ids, layerId) => {
    const { entities } = get()
    const idSet = new Set(ids)
    const changed = entities.filter((e) => idSet.has(e.id) && e.layerId !== layerId)
    if (changed.length === 0) return
    get().commit(entities.map((e) => (idSet.has(e.id) ? { ...e, layerId } : e)))
  },

  updateEntitiesColor: (ids, color) => {
    if (ids.length === 0) return
    const { entities } = get()
    const idSet = new Set(ids)
    get().commit(entities.map((e) => (idSet.has(e.id) ? { ...e, color } : e)))
  },

  loadEntities: (entities) => get().commit(entities),

  commit: (next) => {
    const { entities, past } = get()
    if (next === entities) return
    set({
      entities: next,
      past: [...past, entities].slice(-MAX_HISTORY),
      future: [],
    })
  },

  undo: () => {
    const { entities, past, future } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      entities: prev,
      past: past.slice(0, -1),
      future: [entities, ...future],
    })
  },

  redo: () => {
    const { entities, past, future } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      entities: next,
      past: [...past, entities].slice(-MAX_HISTORY),
      future: future.slice(1),
    })
  },
}))

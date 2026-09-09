import { create } from 'zustand'
import { panBy, zoomAt, type Point, type Viewport } from '../math/coordinates'
import { boundsCenter, getEntityBounds } from '../math/geometry'
import type { SnapResult } from '../math/snap'
import { mirrorEntity, rotateEntity } from '../math/transform'
import { dimensionOffset } from '../../types/dimension'
import { translateEntity, type Entity } from '../../types/entity'
import { useEntityStore } from './useEntityStore'
import { useLayerStore } from './useLayerStore'

/** 当前工具类型 */
export type Tool =
  | 'select'
  | 'pan'
  | 'line'
  | 'rect'
  | 'circle'
  | 'dimension'
  | 'measure'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'trim'
  | 'mirror'
  | 'offset'

/** 编辑命令工具（会话式或单击式） */
export type EditTool = 'move' | 'copy' | 'rotate' | 'trim' | 'mirror' | 'offset'

/** 类型谓词：收窄 Tool → EditTool（App 事件分发处使用） */
export function isEditTool(tool: Tool): tool is EditTool {
  return (
    tool === 'move' ||
    tool === 'copy' ||
    tool === 'rotate' ||
    tool === 'trim' ||
    tool === 'mirror' ||
    tool === 'offset'
  )
}

/** 缩放限制：每世界单位对应的像素数 */
export const MIN_SCALE = 0.01
export const MAX_SCALE = 1000
/** 滚轮缩放系数 */
export const WHEEL_ZOOM_FACTOR = 1.1
/** 初始缩放：1 世界单位 = 50 像素（对应 100% 显示比例） */
export const INITIAL_SCALE = 50

/** 默认视图：世界原点位于屏幕中心 */
const createDefaultView = (): Viewport => ({
  offsetX: window.innerWidth / 2,
  offsetY: window.innerHeight / 2,
  scale: INITIAL_SCALE,
})

/** 绘制过程中的临时草图状态（橡皮筋预览数据） */
export interface DrawDraft {
  tool: 'line' | 'rect' | 'circle' | 'dimension'
  /** line: 起点；rect: 第一角点；circle: 圆心；dimension: 测量起点 */
  start: Point
  /** 当前指针位置（世界坐标；吸附/正交修正后） */
  current: Point
  /** dimension 专用：测量终点（第二次点击锁定，第三次点击确认前为 undefined） */
  end?: Point
}

/** measure 工具的临时卷尺状态（不落盘实体，切换工具或 Esc 即清除） */
export interface MeasureState {
  /** 卷尺起点 */
  start: Point
  /** 卷尺终点（定盘前随指针移动） */
  end: Point
  /** true = 已定盘展示；再次点击开始新测量 */
  done: boolean
}

/** select 工具下的拖拽移动状态（支持多实体批量移动） */
export interface MoveDrag {
  /** 参与拖拽的实体 id（点击已选实体时 = 整个选择集） */
  entityIds: string[]
  /** 按下时的实体快照（渲染与落盘均以此为基准） */
  originals: Entity[]
  /** 按下时指针的世界坐标 */
  startPointer: Point
  /** 累计位移（世界单位） */
  delta: Point
}

/** select 工具下的框选拖拽（屏幕坐标） */
export interface SelectionDrag {
  start: Point
  current: Point
}

/** 编辑命令会话：move/copy/rotate/mirror 的两击式状态机 */
export interface EditSession {
  tool: 'move' | 'copy' | 'rotate' | 'mirror'
  /** 目标实体 id */
  entityId: string
  /** 基准点（首击处；move/copy 的起点、rotate 的旋转中心、mirror 的轴第一点） */
  base: Point
  /** 当前指针位置（世界坐标；吸附/正交修正后） */
  current: Point
}

/** 根据草图与最终指针位置构造实体；尺寸为零的退化图元返回 null（不落盘） */
function buildEntity(draft: DrawDraft, current: Point): Entity | null {
  // 新实体继承当前激活图层；颜色/线宽不写入实体，渲染时跟随图层（图层改色自动同步）
  const base = { id: crypto.randomUUID(), layerId: useLayerStore.getState().activeLayerId }
  switch (draft.tool) {
    case 'line': {
      if (draft.start.x === current.x && draft.start.y === current.y) return null
      return { ...base, type: 'line', start: draft.start, end: current }
    }
    case 'rect': {
      const width = Math.abs(current.x - draft.start.x)
      const height = Math.abs(current.y - draft.start.y)
      if (width === 0 || height === 0) return null
      return {
        ...base,
        type: 'rect',
        x: Math.min(draft.start.x, current.x),
        y: Math.min(draft.start.y, current.y),
        width,
        height,
      }
    }
    case 'circle': {
      const radius = Math.hypot(current.x - draft.start.x, current.y - draft.start.y)
      if (radius === 0) return null
      return { ...base, type: 'circle', center: draft.start, radius }
    }
    case 'dimension': {
      const end = draft.end
      if (!end) return null
      const len = Math.hypot(end.x - draft.start.x, end.y - draft.start.y)
      if (len === 0) return null
      return {
        ...base,
        type: 'dimension',
        start: draft.start,
        end,
        offset: dimensionOffset(draft.start, end, current),
        value: len,
      }
    }
  }
}

interface EditorState {
  /** 当前视口变换（世界原点屏幕偏移 + 缩放比例） */
  view: Viewport
  /** 鼠标指针当前位置的世界坐标（指针离开画布时为 null） */
  cursorWorld: Point | null
  /** 当前激活的工具 */
  activeTool: Tool
  /** 上次激活的绘图/编辑工具（空格键重复命令） */
  lastTool: Tool
  /** 是否处于中键/抓手拖拽平移中 */
  panning: boolean
  /** 绘制草图：非空表示正在交互式绘制中 */
  draft: DrawDraft | null
  /** 当前吸附结果（绘制/标注/测量/编辑工具 + OSNAP 开启时非空） */
  snap: SnapResult | null
  /** 对象捕捉（OSNAP）开关，F3 切换 */
  snapEnabled: boolean
  /** 正交模式（ORTHO）开关，F8 切换；按住 Shift 临时反转 */
  ortho: boolean
  /** 当前选中的实体 id 集合（select 工具；支持框选/多选） */
  selectedIds: string[]
  /** select 工具下的拖拽移动状态 */
  moveDrag: MoveDrag | null
  /** select 工具下的框选拖拽状态（屏幕坐标） */
  selection: SelectionDrag | null
  /** measure 工具的临时卷尺状态（不落盘） */
  measure: MeasureState | null
  /** 编辑命令会话（move/copy/rotate/mirror） */
  edit: EditSession | null
  /** 命令输入框内容（null = 隐藏；画线/画圆时键入数字打开） */
  commandValue: string | null
  /** 镜像时是否保留原对象（工具栏开关） */
  mirrorKeepOriginal: boolean
  /** 偏移距离（世界单位，工具栏输入） */
  offsetDistance: number

  /** 以屏幕锚点为中心缩放（带 MIN/MAX 钳制，越界时忽略本次操作） */
  zoomViewAt: (anchor: Point, factor: number) => void
  /** 平移视图（屏幕像素增量） */
  panViewBy: (dx: number, dy: number) => void
  setCursorWorld: (p: Point | null) => void
  /** 切换工具；工具变化时自动取消进行中的草图、吸附、卷尺、框选与编辑会话 */
  setActiveTool: (tool: Tool) => void
  setPanning: (panning: boolean) => void
  /** 重置视图到默认状态 */
  fitView: () => void

  /** 交互式绘制：按下起点（按当前工具类型创建草图） */
  startDraft: (p: Point) => void
  /** 更新草图指针位置（橡皮筋实时跟随，传入值应已含吸附/正交修正） */
  updateDraft: (p: Point) => void
  /** dimension 第二次点击：锁定测量终点（此后指针位置决定尺寸线偏移） */
  setDraftEnd: (p: Point) => void
  /** 确认草图：按最终指针位置构造实体，写入实体库并推入撤销历史 */
  confirmDraft: (p: Point) => void
  /** 取消当前草图 */
  cancelDraft: () => void

  setSnap: (s: SnapResult | null) => void
  toggleSnapEnabled: () => void
  toggleOrtho: () => void
  setSelectedIds: (ids: string[]) => void
  /** 开始拖拽移动（同时选中该集合） */
  startMove: (entityIds: string[], pointerWorld: Point) => void
  /** 更新拖拽位移 */
  updateMove: (pointerWorld: Point) => void
  /** 结束拖拽：有位移时对整批实体提交一次撤销历史 */
  endMove: () => void

  /** 框选：起点（空白处按下） */
  startSelection: (p: Point) => void
  /** 框选：实时更新对角点 */
  updateSelection: (p: Point) => void
  /** 框选：取消（mouseup 结算后调用） */
  clearSelection: () => void

  /** 编辑会话：首击选实体并记录基准点 */
  startEdit: (tool: EditTool, entityId: string, base: Point) => void
  /** 编辑会话：更新指针位置（预览） */
  updateEdit: (p: Point) => void
  /** 编辑会话：次击确认（move/copy 目标点、rotate 角度、mirror 轴第二点） */
  confirmEdit: (p: Point) => void
  /** 取消编辑会话 */
  clearEdit: () => void

  /** 卷尺：起量（重新开始新测量） */
  startMeasure: (p: Point) => void
  /** 卷尺：实时更新终点 */
  updateMeasure: (p: Point) => void
  /** 卷尺：定盘展示当前结果 */
  confirmMeasure: (p: Point) => void
  /** 卷尺：清除显示 */
  cancelMeasure: () => void

  /** 命令输入：设置/清除输入框内容 */
  setCommandValue: (v: string | null) => void
  /** 命令输入：应用数值（画线=按当前方向定长；画圆=半径） */
  applyCommandValue: (v: number) => void
  toggleMirrorKeepOriginal: () => void
  setOffsetDistance: (d: number) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  view: createDefaultView(),
  cursorWorld: null,
  activeTool: 'select',
  lastTool: 'line',
  panning: false,
  draft: null,
  snap: null,
  snapEnabled: true,
  ortho: false,
  selectedIds: [],
  moveDrag: null,
  selection: null,
  measure: null,
  edit: null,
  commandValue: null,
  mirrorKeepOriginal: true,
  offsetDistance: 0.5,

  zoomViewAt: (anchor, factor) => {
    const next = zoomAt(get().view, anchor, factor)
    if (next.scale < MIN_SCALE || next.scale > MAX_SCALE) return
    set({ view: next })
  },

  panViewBy: (dx, dy) => set({ view: panBy(get().view, dx, dy) }),

  setCursorWorld: (p) => {
    const prev = get().cursorWorld
    if (p === null && prev === null) return
    if (p !== null && prev !== null && p.x === prev.x && p.y === prev.y) return
    set({ cursorWorld: p })
  },

  setActiveTool: (activeTool) => {
    const prev = get().activeTool
    const lastTool =
      activeTool !== 'select' && activeTool !== 'pan' ? activeTool : get().lastTool
    if (prev === activeTool) {
      set({ activeTool })
    } else {
      set({
        activeTool,
        draft: null,
        snap: null,
        measure: null,
        edit: null,
        selection: null,
        lastTool,
      })
    }
  },

  setPanning: (panning) => set({ panning }),
  fitView: () => set({ view: createDefaultView() }),

  startDraft: (start) => {
    const tool = get().activeTool
    if (tool !== 'line' && tool !== 'rect' && tool !== 'circle' && tool !== 'dimension') return
    set({ draft: { tool, start, current: start } })
  },

  updateDraft: (current) => {
    const draft = get().draft
    if (draft) set({ draft: { ...draft, current } })
  },

  setDraftEnd: (end) => {
    const draft = get().draft
    if (draft && draft.tool === 'dimension' && draft.end === undefined) {
      set({ draft: { ...draft, end, current: end } })
    }
  },

  confirmDraft: (current) => {
    const draft = get().draft
    if (!draft) return
    const entity = buildEntity(draft, current)
    if (entity) useEntityStore.getState().addEntities([entity])
    set({ draft: null, snap: null })
  },

  cancelDraft: () => set({ draft: null, snap: null }),

  setSnap: (snap) => {
    const prev = get().snap
    if (snap === null && prev === null) return
    if (
      snap !== null &&
      prev !== null &&
      snap.type === prev.type &&
      snap.point.x === prev.point.x &&
      snap.point.y === prev.point.y
    ) {
      return
    }
    set({ snap })
  },

  toggleSnapEnabled: () => {
    const next = !get().snapEnabled
    set(next ? { snapEnabled: true } : { snapEnabled: false, snap: null })
  },

  toggleOrtho: () => set({ ortho: !get().ortho }),

  setSelectedIds: (ids) => {
    const prev = get().selectedIds
    if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return
    set({ selectedIds: ids })
  },

  startMove: (entityIds, startPointer) => {
    const entities = useEntityStore.getState().entities
    const originals = entities.filter((e) => entityIds.includes(e.id))
    set({ selectedIds: entityIds, moveDrag: { entityIds, originals, startPointer, delta: { x: 0, y: 0 } } })
  },

  updateMove: (pointerWorld) => {
    const drag = get().moveDrag
    if (!drag) return
    set({
      moveDrag: {
        ...drag,
        delta: {
          x: pointerWorld.x - drag.startPointer.x,
          y: pointerWorld.y - drag.startPointer.y,
        },
      },
    })
  },

  endMove: () => {
    const drag = get().moveDrag
    if (!drag) return
    if (drag.delta.x !== 0 || drag.delta.y !== 0) {
      const byId = new Map(drag.originals.map((o) => [o.id, o]))
      const entities = useEntityStore.getState().entities
      useEntityStore.getState().commit(
        entities.map((e) => (byId.has(e.id) ? translateEntity(byId.get(e.id)!, drag.delta) : e)),
      )
    }
    set({ moveDrag: null })
  },

  startSelection: (p) => set({ selection: { start: p, current: p } }),
  updateSelection: (p) => {
    const sel = get().selection
    if (sel) set({ selection: { ...sel, current: p } })
  },
  clearSelection: () => set({ selection: null }),

  startEdit: (tool, entityId, base) => {
    if (tool !== 'move' && tool !== 'copy' && tool !== 'rotate' && tool !== 'mirror') return
    set({ edit: { tool, entityId, base, current: base } })
  },

  updateEdit: (p) => {
    const edit = get().edit
    if (edit) set({ edit: { ...edit, current: p } })
  },

  confirmEdit: (p) => {
    const edit = get().edit
    if (!edit) return
    const entity = useEntityStore.getState().entities.find((e) => e.id === edit.entityId)
    if (entity) {
      switch (edit.tool) {
        case 'move': {
          const delta = { x: p.x - edit.base.x, y: p.y - edit.base.y }
          if (delta.x !== 0 || delta.y !== 0) {
            useEntityStore.getState().replaceEntity(entity.id, translateEntity(entity, delta))
          }
          break
        }
        case 'copy': {
          const delta = { x: p.x - edit.base.x, y: p.y - edit.base.y }
          useEntityStore
            .getState()
            .addEntities([{ ...translateEntity(entity, delta), id: crypto.randomUUID() }])
          break
        }
        case 'rotate': {
          // 参考方向 = 基准点 → 实体锚点（包围盒中心）；旋转量 = 指针方向与参考方向之差
          const anchor = boundsCenter(getEntityBounds(entity))
          const ref = Math.atan2(anchor.y - edit.base.y, anchor.x - edit.base.x)
          const cur = Math.atan2(p.y - edit.base.y, p.x - edit.base.x)
          const angle = ((cur - ref) * 180) / Math.PI
          if (Math.abs(angle) > 1e-9) {
            useEntityStore.getState().replaceEntity(entity.id, rotateEntity(entity, edit.base, angle))
          }
          break
        }
        case 'mirror': {
          const mirrored = mirrorEntity(entity, edit.base, p)
          if (get().mirrorKeepOriginal) {
            // 保留原件：镜像结果是副本，必须换新 id
            useEntityStore.getState().addEntities([{ ...mirrored, id: crypto.randomUUID() }])
          } else {
            useEntityStore.getState().replaceEntity(entity.id, mirrored)
          }
          break
        }
        default:
          break
      }
    }
    set({ edit: null })
  },

  clearEdit: () => set({ edit: null }),

  startMeasure: (p) => set({ measure: { start: p, end: p, done: false } }),

  updateMeasure: (p) => {
    const m = get().measure
    if (m && !m.done) set({ measure: { ...m, end: p } })
  },

  confirmMeasure: (p) => {
    const m = get().measure
    if (m && !m.done) set({ measure: { ...m, end: p, done: true } })
  },

  cancelMeasure: () => set({ measure: null }),

  setCommandValue: (commandValue) => set({ commandValue }),

  applyCommandValue: (v) => {
    const draft = get().draft
    if (draft && v > 0 && Number.isFinite(v)) {
      if (draft.tool === 'line') {
        // 按当前光标方向生成定长线段（无方向时默认 +X）
        const dx = draft.current.x - draft.start.x
        const dy = draft.current.y - draft.start.y
        const len = Math.hypot(dx, dy)
        const ux = len > 0 ? dx / len : 1
        const uy = len > 0 ? dy / len : 0
        get().confirmDraft({ x: draft.start.x + ux * v, y: draft.start.y + uy * v })
      } else if (draft.tool === 'circle') {
        get().confirmDraft({ x: draft.start.x + v, y: draft.start.y })
      }
    }
    set({ commandValue: null })
  },

  toggleMirrorKeepOriginal: () => set({ mirrorKeepOriginal: !get().mirrorKeepOriginal }),
  setOffsetDistance: (offsetDistance) => set({ offsetDistance }),
}))

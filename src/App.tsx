import { useEffect, useRef } from 'react'
import type Konva from 'konva'
import { Layer, Rect, Stage } from 'react-konva'
import DimensionLayer from './components/canvas/DimensionLayer'
import DrawPreviewLayer from './components/canvas/DrawPreviewLayer'
import EditPreviewLayer from './components/canvas/EditPreviewLayer'
import EntityLayer from './components/canvas/EntityLayer'
import GridLayer from './components/canvas/GridLayer'
import MeasureOverlay from './components/canvas/MeasureOverlay'
import SelectionBoxLayer from './components/canvas/SelectionBoxLayer'
import SnapIndicatorLayer from './components/canvas/SnapIndicatorLayer'
import CommandPrompt from './components/layout/CommandPrompt'
import LayerPanel from './components/layout/LayerPanel'
import StatusBar from './components/layout/StatusBar'
import ToolBar from './components/layout/ToolBar'
import TopNavBar from './components/layout/TopNavBar'
import { openProjectFile, saveProjectFile } from './core/io/cadActions'
import { applyOrtho, screenToWorld, type Point } from './core/math/coordinates'
import { collectSelectionIds, trimLine } from './core/math/geometry'
import { findSnap } from './core/math/snap'
import { offsetEntity } from './core/math/transform'
import { isEditTool, useEditorStore, WHEEL_ZOOM_FACTOR } from './core/state/useEditorStore'
import { useEntityStore } from './core/state/useEntityStore'
import { useLayerStore } from './core/state/useLayerStore'
import type { LineEntity } from './types/entity'

/**
 * 根布局：Konva 画布（背景/网格/实体/标注/预览/编辑幽灵/吸附/框选/卷尺九层）
 * + 顶部菜单栏 + 工具栏 + 图层面板 + 状态栏 + 命令输入框。
 * 本组件仅负责把 DOM 事件转发为 store 动作。
 */
export default function App() {
  const stageRef = useRef<Konva.Stage>(null)
  const lastPointer = useRef<Point | null>(null)
  const activeTool = useEditorStore(s => s.activeTool)
  const panning = useEditorStore(s => s.panning)

  const size = { width: window.innerWidth, height: window.innerHeight }

  // 依据工具与拖拽状态切换光标样式
  useEffect(() => {
    const container = stageRef.current?.container()
    if (!container) return
    if (panning) container.style.cursor = 'grabbing'
    else if (activeTool === 'pan') container.style.cursor = 'grab'
    else if (activeTool === 'select') container.style.cursor = 'default'
    else container.style.cursor = 'crosshair'
  }, [panning, activeTool])

  // 全局快捷键：
  // Ctrl+S 保存 / Ctrl+O 打开 / Esc 取消 / Delete·Backspace 批量删除 / F3 对象捕捉 /
  // F8 正交 / 空格重复上一命令 / 数字键命令输入 / Ctrl+Z·Ctrl+Y·Ctrl+Shift+Z 撤销重做
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Ctrl+O：全局拦截（含输入框聚焦时），映射为工程保存/打开
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase()
        if (key === 's') {
          e.preventDefault()
          saveProjectFile()
          return
        }
        if (key === 'o') {
          e.preventDefault()
          openProjectFile()
          return
        }
      }
      // 输入框聚焦时仅响应 Esc（其余按键交给输入框自身，避免误触发画布快捷键）
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        if (e.key === 'Escape') target.blur()
        return
      }
      const st = useEditorStore.getState()
      if (e.key === 'Escape') {
        // Esc：命令输入 → 编辑会话 → 卷尺 → 草图 → 取消选择并回到选择工具
        if (st.commandValue !== null) {
          st.setCommandValue(null)
          return
        }
        if (st.edit) st.clearEdit()
        if (st.measure) st.cancelMeasure()
        if (st.draft) st.cancelDraft()
        if (st.selection) st.clearSelection()
        st.setSelectedIds([])
        st.setActiveTool('select')
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = st.selectedIds
        if (ids.length > 0) {
          const entities = useEntityStore.getState().entities
          const layers = useLayerStore.getState().layers
          // 锁定图层的实体禁止删除，其余一次性批量删除（一步撤销历史）
          const removable = ids.filter(id => {
            const en = entities.find(x => x.id === id)
            if (!en) return false
            const layer = layers.find(l => l.id === en.layerId)
            return layer ? !layer.locked : false
          })
          if (removable.length > 0) {
            e.preventDefault()
            useEntityStore.getState().removeEntities(removable)
            st.setSelectedIds([])
          }
        }
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        st.toggleSnapEnabled()
        return
      }
      if (e.key === 'F8') {
        e.preventDefault()
        st.toggleOrtho()
        return
      }
      if (e.key === ' ') {
        // 空格：重复上一绘图/编辑命令（有进行中的操作时不响应）
        if (!st.draft && !st.edit && !st.measure && !st.selection) {
          const last = st.lastTool
          if (last !== 'select' && last !== 'pan') {
            e.preventDefault()
            st.setActiveTool(last)
          }
        }
        return
      }
      // 画线/画圆草图中直接键入数字：弹出命令输入框（定长/定半径）
      if (/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const d = st.draft
        if (d && (d.tool === 'line' || d.tool === 'circle') && st.commandValue === null) {
          e.preventDefault()
          st.setCommandValue(e.key)
        }
        return
      }
      if (!e.ctrlKey && !e.metaKey) return
      const key = e.key.toLowerCase()
      if (key === 'z' && e.shiftKey) {
        e.preventDefault()
        useEntityStore.getState().redo()
      } else if (key === 'z') {
        e.preventDefault()
        useEntityStore.getState().undo()
      } else if (key === 'y') {
        e.preventDefault()
        useEntityStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /** 当前指针屏幕坐标处的吸附点；OSNAP 关闭或 select/pan 工具时返回 null */
  const snapAt = (pointerScreen: Point) => {
    const { view, activeTool: tool, snapEnabled } = useEditorStore.getState()
    if (!snapEnabled || tool === 'select' || tool === 'pan') return null
    // 隐藏图层不参与吸附（锁定图层仍可吸附）；标注实体不参与吸附
    const visibleIds = new Set(
      useLayerStore.getState().layers.filter(l => l.visible).map(l => l.id),
    )
    const entities = useEntityStore
      .getState()
      .entities.filter(e => visibleIds.has(e.layerId) && e.type !== 'dimension')
    return findSnap(entities, view, pointerScreen)
  }

  /** 滚轮缩放：以鼠标位置为锚点 */
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    const factor = e.evt.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR
    useEditorStore.getState().zoomViewAt(pointer, factor)
  }

  /** 中键平移 / 抓手平移 / 选择（点选·Shift 增选·拖拽·框选）/ 编辑命令 / 绘图起笔与落盘 */
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // 命令输入框打开时，点击画布视为放弃键入
    if (useEditorStore.getState().commandValue !== null) {
      useEditorStore.getState().setCommandValue(null)
    }

    const pointer = stageRef.current?.getPointerPosition() ?? null
    const {
      activeTool: tool,
      draft,
      view,
      edit,
      measure,
      setPanning,
      startDraft,
      setDraftEnd,
      confirmDraft,
      startMove,
      startSelection,
      startEdit,
      confirmEdit,
      startMeasure,
      confirmMeasure,
    } = useEditorStore.getState()

    // 中键：任意工具下均可平移
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      setPanning(true)
      lastPointer.current = pointer
      return
    }
    if (e.evt.button !== 0 || !pointer) return

    // 抓手工具 + 左键：平移
    if (tool === 'pan') {
      e.evt.preventDefault()
      setPanning(true)
      lastPointer.current = pointer
      return
    }

    // 选择工具：命中实体 → 选中/拖拽（Shift 增选）；点击空白 → 开始框选（mouseup 结算）
    if (tool === 'select') {
      const target = e.target
      const entityId = target === target.getStage() ? null : target.id()
      const entity = entityId
        ? useEntityStore.getState().entities.find(en => en.id === entityId)
        : undefined
      if (entity && entityId) {
        // 锁定图层的实体禁止选中与拖拽（点击时忽略，保持当前选择不变）
        const layer = useLayerStore.getState().layers.find(l => l.id === entity.layerId)
        if (layer && !layer.locked) {
          const { selectedIds, setSelectedIds } = useEditorStore.getState()
          const pointerWorld = screenToWorld(pointer, view)
          if (e.evt.shiftKey) {
            // Shift+点击：增选/减选（不开始拖拽）
            setSelectedIds(
              selectedIds.includes(entityId)
                ? selectedIds.filter(id => id !== entityId)
                : [...selectedIds, entityId],
            )
          } else if (selectedIds.includes(entityId)) {
            // 点击已选实体：整组拖动
            startMove(selectedIds, pointerWorld)
          } else {
            setSelectedIds([entityId])
            startMove([entityId], pointerWorld)
          }
        }
      } else {
        startSelection(pointer)
      }
      return
    }

    // 测量工具：第一次点击起量，第二次点击定盘（临时结果不落盘；吸附有效）
    if (tool === 'measure') {
      const snap = snapAt(pointer)
      const world = snap ? snap.point : screenToWorld(pointer, view)
      if (measure && !measure.done) confirmMeasure(world)
      else startMeasure(world)
      return
    }

    // 编辑命令工具
    if (isEditTool(tool)) {
      const target = e.target
      const entityId = target === target.getStage() ? null : target.id()
      const entity = entityId
        ? useEntityStore.getState().entities.find(en => en.id === entityId)
        : undefined

      // 修剪：单次点击立即裁剪（被点线段与最近交点，裁掉点击侧线头）
      if (tool === 'trim') {
        if (!entity || entity.type !== 'line') return
        const layer = useLayerStore.getState().layers.find(l => l.id === entity.layerId)
        if (!layer || layer.locked) return
        const visibleIds = new Set(
          useLayerStore.getState().layers.filter(l => l.visible).map(l => l.id),
        )
        const others = useEntityStore
          .getState()
          .entities.filter(
            (en): en is LineEntity =>
              en.type === 'line' && en.id !== entity.id && visibleIds.has(en.layerId),
          )
        const result = trimLine(entity, screenToWorld(pointer, view), others)
        if (result) {
          if (result.next === null) useEntityStore.getState().removeEntities([entity.id])
          else useEntityStore.getState().replaceEntity(entity.id, result.next)
        }
        return
      }

      // 偏移：单次点击立即生成平行线/同心圆/缩放矩形（距离取自工具栏输入）
      if (tool === 'offset') {
        if (!entity) return
        const layer = useLayerStore.getState().layers.find(l => l.id === entity.layerId)
        if (!layer || layer.locked) return
        const result = offsetEntity(
          entity,
          useEditorStore.getState().offsetDistance,
          screenToWorld(pointer, view),
        )
        if (result) useEntityStore.getState().addEntities([result])
        return
      }

      // move/copy/rotate/mirror：首击选实体（点击处即基准点，吸附有效），次击确认
      const snap = snapAt(pointer)
      const world = snap ? snap.point : screenToWorld(pointer, view)
      if (!edit) {
        if (entity && entityId) {
          const layer = useLayerStore.getState().layers.find(l => l.id === entity.layerId)
          if (layer && !layer.locked) startEdit(tool, entityId, world)
        }
        return
      }
      confirmEdit(world)
      return
    }

    // 绘制/标注工具：命中吸附点时优先锁定到特征点（起点与落盘点均生效）
    const snap = snapAt(pointer)
    const world = snap ? snap.point : screenToWorld(pointer, view)
    if (draft) {
      // 线性标注为三次点击：第二次点击仅锁定测量终点，第三次点击确定偏移并落盘
      if (draft.tool === 'dimension' && draft.end === undefined) setDraftEnd(world)
      else confirmDraft(world)
    } else {
      startDraft(world)
    }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pointer = stageRef.current?.getPointerPosition() ?? null
    const {
      view,
      panning: isPanning,
      draft,
      moveDrag,
      measure,
      edit,
      selection,
      ortho,
      setCursorWorld,
      panViewBy,
      updateDraft,
      updateMove,
      updateMeasure,
      updateEdit,
      updateSelection,
      setSnap,
    } = useEditorStore.getState()
    const world = pointer ? screenToWorld(pointer, view) : null
    setCursorWorld(world)

    // 正交：ORTHO 开关与 Shift 临时激活互斥（按住 Shift 反转当前状态）
    const orthoActive = ortho !== e.evt.shiftKey

    // 吸附判定（绘制/标注/测量/编辑工具 + OSNAP 开启时）
    setSnap(pointer ? snapAt(pointer) : null)

    if (draft && world) {
      const snap = useEditorStore.getState().snap
      let p = snap ? snap.point : world
      if (draft.tool === 'line' && orthoActive) p = applyOrtho(draft.start, p)
      updateDraft(p)
    }

    if (edit && world) {
      const snap = useEditorStore.getState().snap
      let p = snap ? snap.point : world
      if ((edit.tool === 'move' || edit.tool === 'copy') && orthoActive) {
        p = applyOrtho(edit.base, p)
      }
      updateEdit(p)
    }

    if (measure && !measure.done && world) {
      const snap = useEditorStore.getState().snap
      updateMeasure(snap ? snap.point : world)
    }

    if (moveDrag && world) {
      let p = world
      if (orthoActive) p = applyOrtho(moveDrag.startPointer, p)
      updateMove(p)
    }

    if (selection && pointer) updateSelection(pointer)

    const last = lastPointer.current
    if (!isPanning || !pointer || !last) return
    lastPointer.current = pointer
    panViewBy(pointer.x - last.x, pointer.y - last.y)
  }

  const handleMouseUp = () => {
    const { selection, clearSelection, view, setSelectedIds, setPanning, endMove } =
      useEditorStore.getState()
    if (selection) {
      const dx = selection.current.x - selection.start.x
      const dy = selection.current.y - selection.start.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        // 框选结算：窗口（完全包含）/ 交叉（接触即选）；锁定/隐藏图层排除
        const layers = useLayerStore.getState().layers
        const visibleIds = new Set(layers.filter(l => l.visible).map(l => l.id))
        const lockedIds = new Set(layers.filter(l => l.locked).map(l => l.id))
        const candidates = useEntityStore
          .getState()
          .entities.filter(en => visibleIds.has(en.layerId))
        setSelectedIds(collectSelectionIds(selection, view, candidates, lockedIds))
      } else {
        setSelectedIds([]) // 单击空白：取消选择
      }
      clearSelection()
    }
    setPanning(false)
    endMove()
    lastPointer.current = null
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 背景层（listening={false}：点击事件目标直接是 Stage，避免被背景矩形截获） */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="#0b1120" />
        </Layer>
        {/* 自适应网格层 */}
        <GridLayer />
        {/* 实体层（已确认图元，支持多选高亮与批量拖拽移动） */}
        <EntityLayer />
        {/* 尺寸标注层（线性标注，选中/拖拽/删除与实体一致） */}
        <DimensionLayer />
        {/* 橡皮筋预览层（绘制/标注中的临时草图） */}
        <DrawPreviewLayer />
        {/* 编辑命令幽灵预览层（move/copy/rotate/mirror） */}
        <EditPreviewLayer />
        {/* 吸附标记层（特征点高亮与提示） */}
        <SnapIndicatorLayer />
        {/* 窗口/交叉框选矩形层 */}
        <SelectionBoxLayer />
        {/* 卷尺测量悬浮层（临时读数） */}
        <MeasureOverlay />
      </Stage>
      <TopNavBar />
      <ToolBar />
      <LayerPanel />
      <StatusBar />
      <CommandPrompt />
    </div>
  )
}

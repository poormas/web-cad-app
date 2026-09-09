import { Circle, Group, Layer, Line, Rect } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'
import { useLayerStore } from '../../core/state/useLayerStore'
import { translateEntity } from '../../types/entity'
import type { Layer as LayerModel } from '../../types/layer'

/**
 * 实体图层：渲染所有已确认的 CAD 图元。
 * - 实体世界坐标经视口变换 Group 统一映射到屏幕坐标；
 * - strokeScaleEnabled={false} 保证线宽恒定屏幕像素宽；
 * - 图层联动：visible=false 的图层不渲染；实体未单独指定颜色/线宽时跟随所属图层
 *   （图层改色后自动同步）；
 * - 选中实体以蓝色高亮 + 发光轮廓显示；拖拽移动中的实体按「原始快照 + 累计位移」实时跟随，
 *   释放时由 replaceEntity 一次性提交（一步撤销历史）。
 */
export default function EntityLayer() {
  const entities = useEntityStore(s => s.entities)
  const layers = useLayerStore(s => s.layers)
  const view = useEditorStore(s => s.view)
  const selectedIds = useEditorStore(s => s.selectedIds)
  const moveDrag = useEditorStore(s => s.moveDrag)

  /** 查实体所属图层；异常时回退默认 '0' 层 */
  const getLayer = (id: string): LayerModel => layers.find(l => l.id === id) ?? layers[0]

  return (
    <Layer>
      {/* 视口变换：世界坐标 → 屏幕坐标（平移 + 缩放） */}
      <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
        {entities
          .filter(e => e.type !== 'dimension') // 标注实体由 DimensionLayer 单独渲染
          .map(entity => {
          const layer = getLayer(entity.layerId)
          if (!layer.visible) return null // 隐藏图层的实体不渲染
          const selected = selectedIds.includes(entity.id)
          const display =
            moveDrag && moveDrag.entityIds.includes(entity.id)
              ? translateEntity(entity, moveDrag.delta)
              : entity
          const stroke = selected ? '#60a5fa' : (display.color ?? layer.color)
          const strokeWidth = display.strokeWidth ?? layer.strokeWidth
          const glow = selected
            ? { shadowColor: '#3b82f6', shadowBlur: 12, shadowOpacity: 0.9 }
            : undefined
          switch (display.type) {
            case 'line':
              return (
                <Line
                  key={entity.id}
                  id={entity.id}
                  points={[display.start.x, display.start.y, display.end.x, display.end.y]}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeScaleEnabled={false}
                  lineCap="round"
                  lineJoin="round"
                  {...glow}
                />
              )
            case 'rect':
              return (
                <Rect
                  key={entity.id}
                  id={entity.id}
                  x={display.x}
                  y={display.y}
                  width={display.width}
                  height={display.height}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeScaleEnabled={false}
                  {...glow}
                />
              )
            case 'circle':
              return (
                <Circle
                  key={entity.id}
                  id={entity.id}
                  x={display.center.x}
                  y={display.center.y}
                  radius={display.radius}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeScaleEnabled={false}
                  {...glow}
                />
              )
            case 'polyline':
              return (
                <Line
                  key={entity.id}
                  id={entity.id}
                  points={display.points.flatMap(p => [p.x, p.y])}
                  closed={display.closed}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeScaleEnabled={false}
                  lineJoin="round"
                  {...glow}
                />
              )
          }
        })}
      </Group>
    </Layer>
  )
}

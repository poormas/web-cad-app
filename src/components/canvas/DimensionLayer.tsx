import { Group, Layer, Line, Rect, Text } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'
import { useLayerStore } from '../../core/state/useLayerStore'
import { getDimensionGeometry } from '../../types/dimension'
import { translateEntity } from '../../types/entity'
import type { Layer as LayerModel } from '../../types/layer'

/**
 * 尺寸标注图层：渲染所有线性标注实体（标准工程标注样式）。
 * - 两条尺寸界线 + 带实心箭头的尺寸线 + 居中测量数值（保留 2 位小数）；
 * - 箭头、界线延伸、文字大小均按「屏幕恒定」换算（除以 view.scale），
 *   任意缩放比例下标注样式一致、文字清晰（等效 strokeScaleEnabled=false 的效果）；
 * - 与实体层相同：视口变换 Group 映射、图层显隐/颜色联动、选中蓝色高亮发光、
 *   拖拽移动实时跟随（释放时由 replaceEntity 一次性提交历史）。
 */
export default function DimensionLayer() {
  const entities = useEntityStore(s => s.entities)
  const layers = useLayerStore(s => s.layers)
  const view = useEditorStore(s => s.view)
  const selectedIds = useEditorStore(s => s.selectedIds)
  const moveDrag = useEditorStore(s => s.moveDrag)

  /** 查实体所属图层；异常时回退默认 '0' 层 */
  const getLayer = (id: string): LayerModel => layers.find(l => l.id === id) ?? layers[0]

  /** 屏幕恒定字号：世界字号 = 11px / scale */
  const fontSize = 11 / view.scale

  return (
    <Layer>
      {/* 视口变换：世界坐标 → 屏幕坐标（平移 + 缩放） */}
      <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
        {entities
          .filter(e => e.type === 'dimension')
          .map(dim => {
            const layer = getLayer(dim.layerId)
            if (!layer.visible) return null // 隐藏图层的标注不渲染
            const selected = selectedIds.includes(dim.id)
            const display =
              moveDrag && moveDrag.entityIds.includes(dim.id)
                ? translateEntity(dim, moveDrag.delta)
                : dim
            const color = selected ? '#60a5fa' : (display.color ?? layer.color)
            const glow = selected
              ? { shadowColor: '#3b82f6', shadowBlur: 12, shadowOpacity: 0.9 }
              : undefined
            const geom = getDimensionGeometry(
              display.start,
              display.end,
              display.offset,
              view.scale,
              display.value.toFixed(2),
            )
            if (!geom) return null
            return (
              <Group key={dim.id}>
                {/* 两条尺寸界线（细线，1px 屏幕宽） */}
                {geom.extensionLines.map(([a, b], i) => (
                  <Line
                    key={`ext-${i}`}
                    id={dim.id}
                    points={[a.x, a.y, b.x, b.y]}
                    stroke={color}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    {...glow}
                  />
                ))}
                {/* 尺寸线 */}
                <Line
                  id={dim.id}
                  points={[
                    geom.dimLine[0].x,
                    geom.dimLine[0].y,
                    geom.dimLine[1].x,
                    geom.dimLine[1].y,
                  ]}
                  stroke={color}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                  {...glow}
                />
                {/* 两端实心箭头（尖端朝外） */}
                {geom.arrows.map((pts, i) => (
                  <Line
                    key={`arrow-${i}`}
                    id={dim.id}
                    points={[pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y]}
                    closed
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                  />
                ))}
                {/* 居中数值：深色遮罩 + 文字（沿尺寸线方向旋转，永不倒置） */}
                <Group x={geom.text.x} y={geom.text.y} rotation={geom.text.rotation}>
                  <Rect
                    id={dim.id}
                    x={-geom.text.width / 2}
                    y={-geom.text.height / 2}
                    width={geom.text.width}
                    height={geom.text.height}
                    fill="#0b1120"
                    cornerRadius={2 / view.scale}
                  />
                  <Text
                    id={dim.id}
                    x={-geom.text.width / 2}
                    y={-geom.text.height / 2}
                    width={geom.text.width}
                    height={geom.text.height}
                    align="center"
                    verticalAlign="middle"
                    text={display.value.toFixed(2)}
                    fill={color}
                    fontSize={fontSize}
                  />
                </Group>
              </Group>
            )
          })}
      </Group>
    </Layer>
  )
}

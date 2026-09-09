import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'
import { getDimensionGeometry } from '../../types/dimension'
import { translateEntity, type Entity } from '../../types/entity'
import { entityAnchor, mirrorEntity, rotateEntity } from '../../core/math/transform'

/** 编辑预览幽灵样式 */
const GHOST = '#60a5fa'
const DASH = [6, 4]

/** 以虚线幽灵样式渲染任意实体（供编辑命令预览复用） */
function Ghost({ entity, scale }: { entity: Entity; scale: number }) {
  switch (entity.type) {
    case 'line':
      return (
        <Line
          points={[entity.start.x, entity.start.y, entity.end.x, entity.end.y]}
          stroke={GHOST}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          dash={DASH}
        />
      )
    case 'rect':
      return (
        <Rect
          x={entity.x}
          y={entity.y}
          width={entity.width}
          height={entity.height}
          stroke={GHOST}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          dash={DASH}
        />
      )
    case 'circle':
      return (
        <Circle
          x={entity.center.x}
          y={entity.center.y}
          radius={entity.radius}
          stroke={GHOST}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          dash={DASH}
        />
      )
    case 'polyline':
      return (
        <Line
          points={entity.points.flatMap(p => [p.x, p.y])}
          closed={entity.closed}
          stroke={GHOST}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          dash={DASH}
        />
      )
    case 'dimension': {
      const geom = getDimensionGeometry(
        entity.start,
        entity.end,
        entity.offset,
        scale,
        entity.value.toFixed(2),
      )
      if (!geom) return null
      return (
        <Group>
          {geom.extensionLines.map(([a, b], i) => (
            <Line
              key={`gext-${i}`}
              points={[a.x, a.y, b.x, b.y]}
              stroke={GHOST}
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={DASH}
            />
          ))}
          <Line
            points={[
              geom.dimLine[0].x,
              geom.dimLine[0].y,
              geom.dimLine[1].x,
              geom.dimLine[1].y,
            ]}
            stroke={GHOST}
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={DASH}
          />
          <Text
            x={geom.text.x - geom.text.width / 2}
            y={geom.text.y - geom.text.height / 2}
            width={geom.text.width}
            height={geom.text.height}
            align="center"
            verticalAlign="middle"
            text={entity.value.toFixed(2)}
            fill={GHOST}
            fontSize={11 / scale}
          />
        </Group>
      )
    }
  }
}

/**
 * 编辑命令预览层：move/copy 显示位移向量与平移幽灵、
 * rotate 显示旋转半径线与旋转幽灵、mirror 显示镜像轴（绿色虚线）与镜像幽灵。
 * 全程只读渲染，落盘动作在 confirmEdit 中一次性提交。
 */
export default function EditPreviewLayer() {
  const edit = useEditorStore(s => s.edit)
  const view = useEditorStore(s => s.view)
  const entity = useEntityStore(s =>
    edit ? s.entities.find(e => e.id === edit.entityId) : undefined,
  )
  if (!edit || !entity) return null

  let ghost: Entity | null = null
  let axisColor: string | null = null
  switch (edit.tool) {
    case 'move':
    case 'copy':
      ghost = translateEntity(entity, {
        x: edit.current.x - edit.base.x,
        y: edit.current.y - edit.base.y,
      })
      break
    case 'rotate': {
      const anchor = entityAnchor(entity)
      const ref = Math.atan2(anchor.y - edit.base.y, anchor.x - edit.base.x)
      const cur = Math.atan2(edit.current.y - edit.base.y, edit.current.x - edit.base.x)
      ghost = rotateEntity(entity, edit.base, ((cur - ref) * 180) / Math.PI)
      break
    }
    case 'mirror':
      ghost = mirrorEntity(entity, edit.base, edit.current)
      axisColor = '#4ade80'
      break
    default:
      return null
  }

  const markerRadius = 2.5 / view.scale
  return (
    <Layer listening={false}>
      {/* 视口变换：世界坐标 → 屏幕坐标（平移 + 缩放） */}
      <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
        {/* 基准点标记 + 位移向量 / 旋转半径 / 镜像轴 */}
        <Circle x={edit.base.x} y={edit.base.y} radius={markerRadius} fill={GHOST} />
        <Line
          points={[edit.base.x, edit.base.y, edit.current.x, edit.current.y]}
          stroke={axisColor ?? GHOST}
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={DASH}
        />
        <Ghost entity={ghost} scale={view.scale} />
      </Group>
    </Layer>
  )
}

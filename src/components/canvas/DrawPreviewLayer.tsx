import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'
import { dimensionOffset, getDimensionGeometry, type DimensionGeometry } from '../../types/dimension'

/**
 * 绘制过程中的橡皮筋预览层：以虚线实时显示当前草图（起点带标记点）。
 * - line/rect/circle：起点 → 当前指针的虚线形状；
 * - dimension：第一击后显示起点→指针虚线；第二击锁定测量终点后，
 *   实时预览完整标注样式（界线/尺寸线/箭头/数值），随指针决定尺寸线偏移；
 * - 与实体层相同，草图世界坐标经视口变换 Group 统一映射到屏幕坐标。
 */
export default function DrawPreviewLayer() {
  const draft = useEditorStore(s => s.draft)
  const view = useEditorStore(s => s.view)
  if (!draft) return null
  const { tool, start, current, end } = draft
  /** 起点/圆心标记：世界半径 = 3px / scale，屏幕上恒为 3px */
  const markerRadius = 3 / view.scale
  const fontSize = 11 / view.scale

  // 标注第二击后的完整预览几何（第三击前实时更新 offset）
  let dimGeom: DimensionGeometry | null = null
  let dimText = ''
  if (tool === 'dimension' && end) {
    const len = Math.hypot(end.x - start.x, end.y - start.y)
    dimText = len.toFixed(2)
    dimGeom = getDimensionGeometry(
      start,
      end,
      dimensionOffset(start, end, current),
      view.scale,
      dimText,
    )
  }

  return (
    <Layer listening={false}>
      {/* 视口变换：世界坐标 → 屏幕坐标（平移 + 缩放） */}
      <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
        <Circle x={start.x} y={start.y} radius={markerRadius} fill="#fbbf24" />
        {tool === 'line' && (
          <Line
            points={[start.x, start.y, current.x, current.y]}
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        )}
        {tool === 'rect' && (
          <Rect
            x={Math.min(start.x, current.x)}
            y={Math.min(start.y, current.y)}
            width={Math.abs(current.x - start.x)}
            height={Math.abs(current.y - start.y)}
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        )}
        {tool === 'circle' && (
          <Circle
            x={start.x}
            y={start.y}
            radius={Math.hypot(current.x - start.x, current.y - start.y)}
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        )}
        {/* 标注第一击：起点 → 指针的虚线（提示测量方向） */}
        {tool === 'dimension' && !dimGeom && (
          <Line
            points={[start.x, start.y, current.x, current.y]}
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        )}
        {/* 标注第二击后：完整标注样式预览 */}
        {tool === 'dimension' && dimGeom && (
          <Group>
            {dimGeom.extensionLines.map(([a, b], i) => (
              <Line
                key={`pext-${i}`}
                points={[a.x, a.y, b.x, b.y]}
                stroke="#fbbf24"
                strokeWidth={1}
                strokeScaleEnabled={false}
                dash={[6, 4]}
              />
            ))}
            <Line
              points={[
                dimGeom.dimLine[0].x,
                dimGeom.dimLine[0].y,
                dimGeom.dimLine[1].x,
                dimGeom.dimLine[1].y,
              ]}
              stroke="#fbbf24"
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[6, 4]}
            />
            {dimGeom.arrows.map((pts, i) => (
              <Line
                key={`parrow-${i}`}
                points={[pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y]}
                closed
                fill="#fbbf24"
                stroke="#fbbf24"
                strokeWidth={1}
                strokeScaleEnabled={false}
                opacity={0.75}
              />
            ))}
            <Group x={dimGeom.text.x} y={dimGeom.text.y} rotation={dimGeom.text.rotation}>
              <Rect
                x={-dimGeom.text.width / 2}
                y={-dimGeom.text.height / 2}
                width={dimGeom.text.width}
                height={dimGeom.text.height}
                fill="#0b1120"
                cornerRadius={2 / view.scale}
                opacity={0.85}
              />
              <Text
                x={-dimGeom.text.width / 2}
                y={-dimGeom.text.height / 2}
                width={dimGeom.text.width}
                height={dimGeom.text.height}
                align="center"
                verticalAlign="middle"
                text={dimText}
                fill="#fbbf24"
                fontSize={fontSize}
              />
            </Group>
          </Group>
        )}
      </Group>
    </Layer>
  )
}

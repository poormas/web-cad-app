import { Circle, Group, Layer, Rect, RegularPolygon, Text } from 'react-konva'
import type { SnapType } from '../../core/math/snap'
import { useEditorStore } from '../../core/state/useEditorStore'

const LABELS: Record<SnapType, string> = {
  endpoint: '端点',
  midpoint: '中点',
  center: '中心',
  quadrant: '象限点',
}

/**
 * 吸附指示层：吸附命中时在特征点位置渲染高亮标记 + 浮动微型提示文字。
 * 标记形状：端点=绿色方块、中点=黄色三角、中心=青色圆环、象限点=橙色菱形。
 * 所有尺寸按「屏幕像素 / scale」换算为世界单位，经 Group 缩放后保持恒定屏幕大小。
 */
export default function SnapIndicatorLayer() {
  const snap = useEditorStore(s => s.snap)
  const view = useEditorStore(s => s.view)
  if (!snap) return null
  const { point, type } = snap
  const s = view.scale
  const label = LABELS[type]
  const half = 5 / s
  const fontSize = 11 / s
  const labelW = (label.length * 11 + 10) / s
  const labelH = 18 / s

  return (
    <Layer listening={false}>
      <Group x={view.offsetX} y={view.offsetY} scaleX={s} scaleY={s}>
        {type === 'endpoint' && (
          <Rect
            x={point.x - half}
            y={point.y - half}
            width={half * 2}
            height={half * 2}
            fill="#4ade80"
            stroke="#052e16"
            strokeWidth={1.5 / s}
          />
        )}
        {type === 'midpoint' && (
          <RegularPolygon
            x={point.x}
            y={point.y}
            sides={3}
            radius={6 / s}
            fill="#facc15"
            stroke="#422006"
            strokeWidth={1.5 / s}
          />
        )}
        {type === 'center' && (
          <Circle x={point.x} y={point.y} radius={7 / s} stroke="#22d3ee" strokeWidth={2 / s} />
        )}
        {type === 'quadrant' && (
          <RegularPolygon
            x={point.x}
            y={point.y}
            sides={4}
            radius={6 / s}
            rotation={45}
            fill="#fb923c"
            stroke="#431407"
            strokeWidth={1.5 / s}
          />
        )}
        {/* 浮动微型标签 */}
        <Rect
          x={point.x + 10 / s}
          y={point.y - 14 / s}
          width={labelW}
          height={labelH}
          fill="#0f172a"
          opacity={0.85}
          cornerRadius={3 / s}
        />
        <Text
          x={point.x + 15 / s}
          y={point.y - 10.5 / s}
          text={label}
          fontSize={fontSize}
          fontFamily="monospace"
          fill="#f8fafc"
        />
      </Group>
    </Layer>
  )
}

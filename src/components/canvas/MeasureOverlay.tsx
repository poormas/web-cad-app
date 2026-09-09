import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'

/** 估算字符串渲染宽度（世界单位）：CJK/全角字符按 1.1 倍字号，其余按 0.62 倍 */
function estimateWidth(text: string, fontSize: number): number {
  let w = 0
  for (const ch of text) w += ch.charCodeAt(0) > 0xff ? fontSize * 1.1 : fontSize * 0.62
  return w
}

/**
 * 卷尺测量悬浮层（measure 工具，临时结果不落盘）：
 * 起点/终点标记 + 虚线 + 居中读数（距离、ΔX、ΔY，保留 2 位小数）。
 * 测量中为琥珀色，定盘后为翠绿色；切换工具或 Esc 后消失。
 */
export default function MeasureOverlay() {
  const measure = useEditorStore(s => s.measure)
  const view = useEditorStore(s => s.view)
  if (!measure) return null
  const { start, end, done } = measure
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.hypot(dx, dy)
  const color = done ? '#34d399' : '#fbbf24'
  const scale = view.scale

  // 屏幕恒定尺寸 → 世界单位
  const fontSize = 11 / scale
  const markerRadius = 3 / scale
  const pad = 6 / scale
  const gap = 6 / scale

  const line1 = `距离 ${dist.toFixed(2)}`
  const line2 = `ΔX ${dx.toFixed(2)}  ΔY ${dy.toFixed(2)}`
  const w = Math.max(estimateWidth(line1, fontSize), estimateWidth(line2, fontSize)) + pad * 2
  const h = fontSize * 2.8 + pad * 2 // 两行文字 + 内边距

  // 读数放在卷尺线法线一侧，旋转角归一化避免倒置
  const len = dist > 0 ? dist : 1
  const nx = -dy / len
  const ny = dx / len
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle > 90) angle -= 180
  else if (angle <= -90) angle += 180
  const cx = (start.x + end.x) / 2 + nx * (gap + h / 2)
  const cy = (start.y + end.y) / 2 + ny * (gap + h / 2)

  return (
    <Layer listening={false}>
      {/* 视口变换：世界坐标 → 屏幕坐标（平移 + 缩放） */}
      <Group x={view.offsetX} y={view.offsetY} scaleX={view.scale} scaleY={view.scale}>
        {/* 卷尺虚线 */}
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={color}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          dash={[6, 4]}
        />
        {/* 两端标记点 */}
        <Circle x={start.x} y={start.y} radius={markerRadius} fill={color} />
        <Circle x={end.x} y={end.y} radius={markerRadius} fill={color} />
        {/* 居中读数：深色遮罩 + 两行文字 */}
        <Group x={cx} y={cy} rotation={angle}>
          <Rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            fill="#0b1120"
            cornerRadius={2 / scale}
            opacity={0.9}
          />
          <Text
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            align="center"
            verticalAlign="middle"
            text={`${line1}\n${line2}`}
            fill={color}
            fontSize={fontSize}
            lineHeight={1.4}
          />
        </Group>
      </Group>
    </Layer>
  )
}

import { Arrow, Layer, Line, Text } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'

/** 次级网格步长（屏幕像素） */
const MINOR_STEP = 10
/** 主网格步长（屏幕像素，= MINOR_STEP × 10） */

/**
 * 自适应工程网格图层（位于实体图层之下的底层 Layer）：
 *
 * - 网格以「屏幕像素」为固定步长（次级 10px / 主网格 100px），锚定世界原点：
 *   随平移一起移动、随缩放保持屏幕密度恒定，因此任意缩放级别下线条数量不变，
 *   不会出现 Zoom Out 过度时线条密集卡顿或发黑；世界单位密度随 scale 自动变化。
 * - 网格透明度随 log(scale) 线性自适应：缩小到极限时次级网格逐渐淡出，仅保留主网格。
 * - 世界原点处绘制明显的 X（红）/ Y（绿）轴指示线，含正方向箭头与标签。
 */
export default function GridLayer() {
  const view = useEditorStore(s => s.view)
  const { scale, offsetX, offsetY } = view
  const width = window.innerWidth
  const height = window.innerHeight

  // 收集网格线段：位置 = offset + k·MINOR_STEP，k ≡ 0 (mod 10) 的线为主网格（每 100px 一条）
  const minor: number[][] = []
  const major: number[][] = []
  for (let k = Math.ceil(-offsetX / MINOR_STEP); offsetX + k * MINOR_STEP <= width; k++) {
    const x = offsetX + k * MINOR_STEP
    ;(k % 10 === 0 ? major : minor).push([x, 0, x, height])
  }
  for (let k = Math.ceil(-offsetY / MINOR_STEP); offsetY + k * MINOR_STEP <= height; k++) {
    const y = offsetY + k * MINOR_STEP
    ;(k % 10 === 0 ? major : minor).push([0, y, width, y])
  }

  // 透明度随 log10(scale) 线性自适应：scale 0.01 → t=0，scale 1000 → t=1
  const t = Math.min(1, Math.max(0, (Math.log10(scale) + 2) / 5))
  const minorOpacity = 0.03 + 0.15 * t
  const majorOpacity = 0.1 + 0.25 * t

  // 世界坐标轴是否穿过当前视口
  const showXAxis = offsetY >= 0 && offsetY <= height
  const showYAxis = offsetX >= 0 && offsetX <= width
  const showOrigin = showXAxis && showYAxis

  return (
    <Layer listening={false}>
      {/* 次级网格 */}
      {minor.map((pts, i) => (
        <Line key={`mn${i}`} points={pts} stroke="#475569" strokeWidth={1} opacity={minorOpacity} />
      ))}
      {/* 主网格 */}
      {major.map((pts, i) => (
        <Line key={`mj${i}`} points={pts} stroke="#64748b" strokeWidth={1} opacity={majorOpacity} />
      ))}

      {/* X 轴（红）：世界 Y = 0 */}
      {showXAxis && (
        <Line points={[0, offsetY, width, offsetY]} stroke="#f87171" strokeWidth={1} opacity={0.9} />
      )}
      {/* Y 轴（绿）：世界 X = 0 */}
      {showYAxis && (
        <Line points={[offsetX, 0, offsetX, height]} stroke="#4ade80" strokeWidth={1} opacity={0.9} />
      )}

      {/* 原点处的正方向箭头与轴标签（当前世界 Y 向下，故 Y 正方向朝屏幕下方） */}
      {showOrigin && (
        <>
          <Arrow
            points={[offsetX + 8, offsetY, offsetX + 24, offsetY]}
            fill="#f87171"
            stroke="#f87171"
            strokeWidth={1}
            pointerLength={6}
            pointerWidth={6}
          />
          <Text
            x={offsetX + 28}
            y={offsetY - 15}
            text="X"
            fontSize={12}
            fontFamily="monospace"
            fill="#f87171"
          />
          <Arrow
            points={[offsetX, offsetY + 8, offsetX, offsetY + 24]}
            fill="#4ade80"
            stroke="#4ade80"
            strokeWidth={1}
            pointerLength={6}
            pointerWidth={6}
          />
          <Text
            x={offsetX + 6}
            y={offsetY + 26}
            text="Y"
            fontSize={12}
            fontFamily="monospace"
            fill="#4ade80"
          />
        </>
      )}
    </Layer>
  )
}

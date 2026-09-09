import { Layer, Rect } from 'react-konva'
import { useEditorStore } from '../../core/state/useEditorStore'

/**
 * 框选矩形层（屏幕坐标直接渲染，不经过视口变换）：
 * - 自左向右：窗口选择（Window），实线蓝框，完全包含才选中；
 * - 自右向左：交叉选择（Crossing），虚线绿框，接触即选中。
 */
export default function SelectionBoxLayer() {
  const selection = useEditorStore(s => s.selection)
  if (!selection) return null
  const x = Math.min(selection.start.x, selection.current.x)
  const y = Math.min(selection.start.y, selection.current.y)
  const width = Math.abs(selection.current.x - selection.start.x)
  const height = Math.abs(selection.current.y - selection.start.y)
  const windowSel = selection.start.x <= selection.current.x
  return (
    <Layer listening={false}>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={windowSel ? '#3b82f6' : '#22c55e'}
        strokeWidth={1}
        dash={windowSel ? undefined : [6, 4]}
        fill={windowSel ? 'rgba(59,130,246,0.08)' : 'rgba(34,197,94,0.08)'}
      />
    </Layer>
  )
}

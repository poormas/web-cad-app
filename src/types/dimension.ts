import type { Point } from '../core/math/coordinates'

/**
 * 线性尺寸标注实体：测量 start→end 的直线距离，
 * 尺寸线沿测量线法线方向偏移 offset（世界单位，有符号）。
 */
export interface DimensionEntity {
  id: string
  type: 'dimension'
  layerId: string
  /** 测量起点（世界坐标） */
  start: Point
  /** 测量终点（世界坐标） */
  end: Point
  /** 尺寸线相对测量线的有向偏移（世界单位，第三次点击确定） */
  offset: number
  /** 测量数值（= |end - start|，实体平移时长度不变） */
  value: number
  /** 线色；未单独指定时渲染跟随所属图层颜色 */
  color?: string
}

/** 标注渲染常量（屏幕像素；除以 view.scale 即得世界单位） */
const ARROW_LEN_PX = 9 // 箭头长度
const ARROW_HALF_PX = 3.5 // 箭头半宽
const EXT_OVER_PX = 3 // 尺寸界线越过尺寸线的长度
const TEXT_PX = 11 // 标注文字字号
const TEXT_GAP_PX = 3 // 文字底边与尺寸线间距
const MASK_PAD_PX = 4 // 文字遮罩内边距

export interface DimensionGeometry {
  /** 两条尺寸界线（[起点（在实体上）, 终点（越过尺寸线）]） */
  extensionLines: [Point, Point][]
  /** 尺寸线两端点（世界坐标） */
  dimLine: [Point, Point]
  /** 两端箭头实心三角（[尖端, 翼1, 翼2]） */
  arrows: [Point, Point, Point][]
  /** 文字：中心点世界坐标 + 旋转角（度）+ 遮罩包围盒（世界单位） */
  text: { x: number; y: number; rotation: number; width: number; height: number }
}

/**
 * 计算标注渲染几何：两条尺寸界线 + 带实心箭头的尺寸线 + 居中测量数值。
 * 箭头、界线延伸、文字大小均换算为「屏幕恒定」的世界尺寸（传入 view.scale），
 * 保证任意缩放比例下标注样式一致、文字清晰。start 与 end 重合时返回 null。
 */
export function getDimensionGeometry(
  start: Point,
  end: Point,
  offset: number,
  scale: number,
  text: string,
): DimensionGeometry | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const ux = dx / len
  const uy = dy / len
  const nx = -uy // 测量线左法线
  const ny = ux

  const p1: Point = { x: start.x + nx * offset, y: start.y + ny * offset }
  const p2: Point = { x: end.x + nx * offset, y: end.y + ny * offset }

  const arrowLen = ARROW_LEN_PX / scale
  const arrowHalf = ARROW_HALF_PX / scale
  const over = EXT_OVER_PX / scale

  const extensionLines: [Point, Point][] = [
    [start, { x: p1.x + nx * over, y: p1.y + ny * over }],
    [end, { x: p2.x + nx * over, y: p2.y + ny * over }],
  ]
  // 箭头尖端在尺寸线端点、两翼向尺寸线内侧展开（指向外侧）
  const arrows: [Point, Point, Point][] = [
    [
      p1,
      { x: p1.x + ux * arrowLen + nx * arrowHalf, y: p1.y + uy * arrowLen + ny * arrowHalf },
      { x: p1.x + ux * arrowLen - nx * arrowHalf, y: p1.y + uy * arrowLen - ny * arrowHalf },
    ],
    [
      p2,
      { x: p2.x - ux * arrowLen + nx * arrowHalf, y: p2.y - uy * arrowLen + ny * arrowHalf },
      { x: p2.x - ux * arrowLen - nx * arrowHalf, y: p2.y - uy * arrowLen - ny * arrowHalf },
    ],
  ]

  // 文字：尺寸线中点上方、沿尺寸线方向旋转；归一化到 (-90°, 90°] 避免文字倒置
  let rotation = (Math.atan2(uy, ux) * 180) / Math.PI
  if (rotation > 90) rotation -= 180
  else if (rotation <= -90) rotation += 180

  const fontSize = TEXT_PX / scale
  const pad = MASK_PAD_PX / scale
  const width = text.length * fontSize * 0.62 + pad * 2
  const height = fontSize * 1.25 + pad * 2
  const gap = TEXT_GAP_PX / scale
  const cx = (p1.x + p2.x) / 2 + nx * (gap + height / 2)
  const cy = (p1.y + p2.y) / 2 + ny * (gap + height / 2)

  return {
    extensionLines,
    dimLine: [p1, p2],
    arrows,
    text: { x: cx, y: cy, rotation, width, height },
  }
}

/** 计算 point 相对 start→end 测量线的有向偏移（即标注的 offset） */
export function dimensionOffset(start: Point, end: Point, point: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return 0
  return ((point.x - start.x) * -dy + (point.y - start.y) * dx) / len
}

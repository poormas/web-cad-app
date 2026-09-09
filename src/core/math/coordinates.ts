/**
 * 坐标转换模块：屏幕坐标系 ↔ CAD 世界坐标系
 *
 * - 屏幕坐标：像素，原点在画布左上角，Y 向下
 * - 世界坐标：CAD 单位，与屏幕同向（Y 向下）
 *
 * 若后续需要 CAD 惯用的「Y 向上」，只需在 worldToScreen / screenToWorld 中对 y 取负即可，
 * 其余（zoomAt / panBy）不依赖 Y 方向，无需改动。
 */

export interface Point {
  x: number
  y: number
}

/** 视图变换：世界原点在屏幕上的偏移 + 缩放比例（1 世界单位 = scale 像素） */
export interface Viewport {
  /** 世界原点在屏幕上的 X（像素） */
  offsetX: number
  /** 世界原点在屏幕上的 Y（像素） */
  offsetY: number
  /** 缩放比例：像素 / 世界单位 */
  scale: number
}

/** 世界坐标 → 屏幕坐标 */
export function worldToScreen(p: Point, view: Viewport): Point {
  return {
    x: p.x * view.scale + view.offsetX,
    y: p.y * view.scale + view.offsetY,
  }
}

/** 屏幕坐标 → 世界坐标 */
export function screenToWorld(p: Point, view: Viewport): Point {
  return {
    x: (p.x - view.offsetX) / view.scale,
    y: (p.y - view.offsetY) / view.scale,
  }
}

/** 以屏幕上某一点为锚点缩放：缩放前后，锚点处的世界坐标保持不动 */
export function zoomAt(view: Viewport, anchor: Point, factor: number): Viewport {
  const world = screenToWorld(anchor, view)
  const scale = view.scale * factor
  return {
    scale,
    offsetX: anchor.x - world.x * scale,
    offsetY: anchor.y - world.y * scale,
  }
}

/** 平移视图：屏幕内容整体移动 (dx, dy) 像素 */
export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return {
    ...view,
    offsetX: view.offsetX + dx,
    offsetY: view.offsetY + dy,
  }
}

/**
 * 正交锁定：将目标点约束到以 base 为基准的水平或垂直方向上
 * （取偏移量绝对值较大的轴；画线/移动时用于 ORTHO 模式）。
 */
export function applyOrtho(base: Point, p: Point): Point {
  const dx = p.x - base.x
  const dy = p.y - base.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: p.x, y: base.y }
  return { x: base.x, y: p.y }
}

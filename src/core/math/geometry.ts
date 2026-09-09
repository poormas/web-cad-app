import { screenToWorld, type Point, type Viewport } from './coordinates'
import type { Entity, LineEntity } from '../../types/entity'

/** 轴对齐包围盒（世界坐标） */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function fromPoints(pts: Point[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/** 实体轴对齐包围盒（世界坐标；标注计入尺寸线偏移范围） */
export function getEntityBounds(entity: Entity): Bounds {
  switch (entity.type) {
    case 'line':
      return fromPoints([entity.start, entity.end])
    case 'rect':
      return {
        minX: entity.x,
        minY: entity.y,
        maxX: entity.x + entity.width,
        maxY: entity.y + entity.height,
      }
    case 'circle':
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius,
      }
    case 'polyline':
      return fromPoints(entity.points)
    case 'dimension': {
      const dx = entity.end.x - entity.start.x
      const dy = entity.end.y - entity.start.y
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      return fromPoints([
        entity.start,
        entity.end,
        { x: entity.start.x + nx * entity.offset, y: entity.start.y + ny * entity.offset },
        { x: entity.end.x + nx * entity.offset, y: entity.end.y + ny * entity.offset },
      ])
    }
  }
}

/** 包围盒中心 */
export function boundsCenter(b: Bounds): Point {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
}

/**
 * 两线段交点（含交点在第一线段上的参数 t）。
 * 平行、或交点不落在两线段范围内时返回 null。
 */
export function segmentIntersectionT(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): { point: Point; t: number } | null {
  const d1x = a2.x - a1.x
  const d1y = a2.y - a1.y
  const d2x = b2.x - b1.x
  const d2y = b2.y - b1.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-12) return null
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { point: { x: a1.x + t * d1x, y: a1.y + t * d1y }, t }
}

/**
 * 修剪（Trim）：点击线段某一侧，与候选线段求最近交点并裁掉该侧线头。
 * - 返回 null：未发生修剪（无交点或退化）；
 * - 返回 { next: LineEntity }：剩余保留段（调用方替换原实体）；
 * - 返回 { next: null }：交点即另一端 → 整条删除。
 */
export function trimLine(
  clicked: LineEntity,
  clickPoint: Point,
  others: LineEntity[],
): { next: LineEntity | null } | null {
  const d1x = clicked.end.x - clicked.start.x
  const d1y = clicked.end.y - clicked.start.y
  const len2 = d1x * d1x + d1y * d1y
  if (len2 === 0) return null
  const tClick =
    ((clickPoint.x - clicked.start.x) * d1x + (clickPoint.y - clicked.start.y) * d1y) / len2
  let best: { point: Point; t: number } | null = null
  let bestDist = Infinity
  for (const o of others) {
    const hit = segmentIntersectionT(clicked.start, clicked.end, o.start, o.end)
    if (!hit) continue
    const d = Math.hypot(hit.point.x - clickPoint.x, hit.point.y - clickPoint.y)
    if (d < bestDist) {
      bestDist = d
      best = hit
    }
  }
  if (!best) return null
  const EPS = 1e-9
  if (tClick < best.t) {
    // 点击在起点一侧：裁掉 [起点..交点]，保留 [交点..终点]
    if (best.t > 1 - EPS) return { next: null }
    return { next: { ...clicked, start: best.point } }
  }
  // 点击在终点一侧：保留 [起点..交点]
  if (best.t < EPS) return { next: null }
  return { next: { ...clicked, end: best.point } }
}

/**
 * 框选结算：屏幕起止点 → 世界矩形，按窗口/交叉模式判定选中集合。
 * - 自左向右（Window，窗口）：实体包围盒完全落在框内才选中；
 * - 自右向左（Crossing，交叉）：包围盒与框有任何接触即选中。
 * lockedIds（锁定图层）的实体不参与；调用方应只传入可见图层的实体。
 */
export function collectSelectionIds(
  selection: { start: Point; current: Point },
  view: Viewport,
  entities: Entity[],
  lockedIds: Set<string>,
): string[] {
  const w1 = screenToWorld(selection.start, view)
  const w2 = screenToWorld(selection.current, view)
  const minX = Math.min(w1.x, w2.x)
  const maxX = Math.max(w1.x, w2.x)
  const minY = Math.min(w1.y, w2.y)
  const maxY = Math.max(w1.y, w2.y)
  const windowSel = selection.start.x <= selection.current.x
  const ids: string[] = []
  for (const e of entities) {
    if (lockedIds.has(e.layerId)) continue
    const b = getEntityBounds(e)
    const inside = b.minX >= minX && b.maxX <= maxX && b.minY >= minY && b.maxY <= maxY
    const touches = b.minX <= maxX && b.maxX >= minX && b.minY <= maxY && b.maxY >= minY
    if (windowSel ? inside : touches) ids.push(e.id)
  }
  return ids
}

import type { Point } from './coordinates'
import type { Entity } from '../../types/entity'
import { boundsCenter, getEntityBounds } from './geometry'

/** 点绕中心旋转（角度制，顺时针为世界坐标下的正角） */
export function rotatePoint(p: Point, center: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

/** 点关于直线（a→b 为轴）的镜像 */
export function mirrorPoint(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return p
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  const foot = { x: a.x + t * dx, y: a.y + t * dy }
  return { x: 2 * foot.x - p.x, y: 2 * foot.y - p.y }
}

type RectLike = Extract<Entity, { type: 'rect' }>

/** 矩形四角点（世界坐标） */
function rectCorners(e: RectLike): Point[] {
  return [
    { x: e.x, y: e.y },
    { x: e.x + e.width, y: e.y },
    { x: e.x + e.width, y: e.y + e.height },
    { x: e.x, y: e.y + e.height },
  ]
}

/** 矩形 → 封闭多段线（旋转/斜镜像等非轴对齐变换时使用，id 不变以便原地替换） */
function rectToPolyline(e: RectLike, map: (p: Point) => Point): Entity {
  return {
    id: e.id,
    type: 'polyline',
    layerId: e.layerId,
    color: e.color,
    strokeWidth: e.strokeWidth,
    points: rectCorners(e).map(map),
    closed: true,
  }
}

/**
 * 绕 center 旋转 angleDeg 度：直线/多段线/圆/标注直接旋转；
 * 矩形无法表达旋转姿态，转为封闭多段线（id 不变，原地替换）。
 */
export function rotateEntity(entity: Entity, center: Point, angleDeg: number): Entity {
  const rot = (p: Point) => rotatePoint(p, center, angleDeg)
  switch (entity.type) {
    case 'line':
      return { ...entity, start: rot(entity.start), end: rot(entity.end) }
    case 'circle':
      return { ...entity, center: rot(entity.center) }
    case 'polyline':
      return { ...entity, points: entity.points.map(rot) }
    case 'dimension':
      // 旋转后左法线随几何同步旋转，offset 数值不变
      return { ...entity, start: rot(entity.start), end: rot(entity.end) }
    case 'rect':
      return rectToPolyline(entity, rot)
  }
}

/**
 * 关于镜像轴（a→b）对称：标注 offset 取反（法线随镜像翻转）；
 * 矩形仅当轴为水平/垂直时保持矩形，否则转为封闭多段线。
 */
export function mirrorEntity(entity: Entity, a: Point, b: Point): Entity {
  const mir = (p: Point) => mirrorPoint(p, a, b)
  switch (entity.type) {
    case 'line':
      return { ...entity, start: mir(entity.start), end: mir(entity.end) }
    case 'circle':
      return { ...entity, center: mir(entity.center) }
    case 'polyline':
      return { ...entity, points: entity.points.map(mir) }
    case 'dimension':
      return { ...entity, start: mir(entity.start), end: mir(entity.end), offset: -entity.offset }
    case 'rect': {
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (dy === 0) {
        // 水平轴：仅翻转 y
        return { ...entity, y: 2 * a.y - (entity.y + entity.height) }
      }
      if (dx === 0) {
        // 垂直轴：仅翻转 x
        return { ...entity, x: 2 * a.x - (entity.x + entity.width) }
      }
      return rectToPolyline(entity, mir)
    }
  }
}

/**
 * 偏移（Offset）：直线→点击侧平行线、圆→内/外同心圆、矩形→放大/缩小矩形。
 * 生成的是新实体（id 重新生成，原实体保留）；其余类型（多段线/标注）返回 null。
 */
export function offsetEntity(entity: Entity, distance: number, sidePoint: Point): Entity | null {
  if (distance <= 0) return null
  switch (entity.type) {
    case 'line': {
      const dx = entity.end.x - entity.start.x
      const dy = entity.end.y - entity.start.y
      const len = Math.hypot(dx, dy)
      if (len === 0) return null
      const nx = -dy / len // 左法线
      const ny = dx / len
      const side =
        (sidePoint.x - entity.start.x) * nx + (sidePoint.y - entity.start.y) * ny >= 0 ? 1 : -1
      const d = distance * side
      return {
        ...entity,
        id: crypto.randomUUID(),
        start: { x: entity.start.x + nx * d, y: entity.start.y + ny * d },
        end: { x: entity.end.x + nx * d, y: entity.end.y + ny * d },
      }
    }
    case 'circle': {
      const inside =
        Math.hypot(sidePoint.x - entity.center.x, sidePoint.y - entity.center.y) < entity.radius
      const radius = inside ? entity.radius - distance : entity.radius + distance
      if (radius <= 0) return null
      return { ...entity, id: crypto.randomUUID(), radius }
    }
    case 'rect': {
      const inside =
        sidePoint.x > entity.x &&
        sidePoint.x < entity.x + entity.width &&
        sidePoint.y > entity.y &&
        sidePoint.y < entity.y + entity.height
      const d = inside ? -distance : distance
      const width = entity.width + 2 * d
      const height = entity.height + 2 * d
      if (width <= 0 || height <= 0) return null
      return {
        ...entity,
        id: crypto.randomUUID(),
        x: entity.x - d,
        y: entity.y - d,
        width,
        height,
      }
    }
    default:
      return null
  }
}

/** 实体的「几何锚点」：包围盒中心（旋转预览的参考方向） */
export function entityAnchor(entity: Entity): Point {
  return boundsCenter(getEntityBounds(entity))
}

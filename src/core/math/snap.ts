import { worldToScreen, type Point, type Viewport } from './coordinates'
import type { Entity } from '../../types/entity'

/** 吸附点类型 */
export type SnapType = 'endpoint' | 'midpoint' | 'center' | 'quadrant'

/** 吸附结果：吸附点的世界坐标与类型 */
export interface SnapResult {
  point: Point
  type: SnapType
}

/** 吸附判定阈值（屏幕像素） */
export const SNAP_THRESHOLD_PX = 12

/**
 * 计算单个实体的关键特征点（世界坐标）：
 * - 直线：两端点（endpoint）、线段中点（midpoint）
 * - 矩形：四顶点（endpoint）、四边中点（midpoint）、几何中心（center）
 * - 圆：圆心（center）、上下左右 4 个象限点（quadrant）
 * - 多段线：各段端点（endpoint）
 * - 标注：不提供特征点（注释性实体不参与吸附）
 */
export function getEntitySnapPoints(entity: Entity): SnapResult[] {
  switch (entity.type) {
    case 'line': {
      const mid = {
        x: (entity.start.x + entity.end.x) / 2,
        y: (entity.start.y + entity.end.y) / 2,
      }
      return [
        { point: entity.start, type: 'endpoint' },
        { point: entity.end, type: 'endpoint' },
        { point: mid, type: 'midpoint' },
      ]
    }
    case 'rect': {
      const { x, y, width, height } = entity
      const cx = x + width / 2
      const cy = y + height / 2
      return [
        { point: { x, y }, type: 'endpoint' },
        { point: { x: x + width, y }, type: 'endpoint' },
        { point: { x, y: y + height }, type: 'endpoint' },
        { point: { x: x + width, y: y + height }, type: 'endpoint' },
        { point: { x: cx, y }, type: 'midpoint' },
        { point: { x: cx, y: y + height }, type: 'midpoint' },
        { point: { x, y: cy }, type: 'midpoint' },
        { point: { x: x + width, y: cy }, type: 'midpoint' },
        { point: { x: cx, y: cy }, type: 'center' },
      ]
    }
    case 'circle': {
      const { x, y } = entity.center
      const r = entity.radius
      return [
        { point: entity.center, type: 'center' },
        { point: { x, y: y - r }, type: 'quadrant' },
        { point: { x, y: y + r }, type: 'quadrant' },
        { point: { x: x - r, y }, type: 'quadrant' },
        { point: { x: x + r, y }, type: 'quadrant' },
      ]
    }
    case 'polyline':
      return entity.points.map(p => ({ point: p, type: 'endpoint' as const }))
    case 'dimension':
      // 标注为注释性实体，不参与几何吸附
      return []
  }
}

/**
 * 吸附判定：遍历所有实体特征点，转换为屏幕像素坐标后与鼠标屏幕坐标
 * 比较距离，取最小者；距离小于阈值（SNAP_THRESHOLD_PX，12px）时命中，
 * 返回该点的世界坐标与类型，否则返回 null。
 */
export function findSnap(
  entities: Entity[],
  view: Viewport,
  pointerScreen: Point,
): SnapResult | null {
  let best: SnapResult | null = null
  let bestDist = Infinity
  for (const entity of entities) {
    for (const snap of getEntitySnapPoints(entity)) {
      const s = worldToScreen(snap.point, view)
      const d = Math.hypot(s.x - pointerScreen.x, s.y - pointerScreen.y)
      if (d < bestDist) {
        bestDist = d
        best = snap
      }
    }
  }
  return bestDist <= SNAP_THRESHOLD_PX ? best : null
}

import type { Point } from '../core/math/coordinates'
import type { DimensionEntity } from './dimension'

/** 实体公共字段 */
interface EntityBase {
  /** 全局唯一 id */
  id: string
  /** 所属图层 id（默认 '0'） */
  layerId: string
  /** 线色；未单独指定时渲染跟随所属图层颜色（图层改色自动同步） */
  color?: string
  /** 线宽（世界单位）；未单独指定时渲染跟随所属图层线宽 */
  strokeWidth?: number
}

/** 直线：起点 + 终点（世界坐标） */
export interface LineEntity extends EntityBase {
  type: 'line'
  start: Point
  end: Point
}

/** 矩形：左上角坐标 + 宽高（当前世界 Y 向下，「左上角」即 x/y 最小值） */
export interface RectEntity extends EntityBase {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

/** 圆：圆心 + 半径 */
export interface CircleEntity extends EntityBase {
  type: 'circle'
  center: Point
  radius: number
}

/** 多段线：顶点序列（旋转/斜镜像后的矩形等非轴对齐几何） */
export interface PolylineEntity extends EntityBase {
  type: 'polyline'
  points: Point[]
  /** 是否首尾闭合 */
  closed: boolean
}

/** 实体联合类型（标注也纳入实体库，撤销/重做/图层/删除机制自然复用） */
export type Entity = LineEntity | RectEntity | CircleEntity | PolylineEntity | DimensionEntity

/**
 * 将实体整体平移 (dx, dy)，返回同类型的新实体（纯函数，不修改原对象）。
 * 泛型签名保证调用方按传入实体的具体类型收窄返回结果。
 */
export function translateEntity<E extends Entity>(entity: E, delta: Point): E {
  switch (entity.type) {
    case 'line':
      return {
        ...entity,
        start: { x: entity.start.x + delta.x, y: entity.start.y + delta.y },
        end: { x: entity.end.x + delta.x, y: entity.end.y + delta.y },
      } as E
    case 'rect':
      return { ...entity, x: entity.x + delta.x, y: entity.y + delta.y } as E
    case 'circle':
      return {
        ...entity,
        center: { x: entity.center.x + delta.x, y: entity.center.y + delta.y },
      } as E
    case 'polyline':
      return {
        ...entity,
        points: entity.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y })),
      } as E
    case 'dimension':
      // 平移后 |end - start| 不变，value 无需重算
      return {
        ...entity,
        start: { x: entity.start.x + delta.x, y: entity.start.y + delta.y },
        end: { x: entity.end.x + delta.x, y: entity.end.y + delta.y },
      } as E
  }
}

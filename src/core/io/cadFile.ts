import DxfParser from 'dxf-parser'
import Drawing from 'dxf-writer'
import type { Point } from '../math/coordinates'
import { DEFAULT_LAYER, sanitizeLayers } from '../../types/layer'
import type { Layer } from '../../types/layer'
import type {
  CircleEntity,
  Entity,
  LineEntity,
  PolylineEntity,
  RectEntity,
} from '../../types/entity'
import type { DimensionEntity } from '../../types/dimension'

/** .cad.json 工程文件版本 */
const PROJECT_VERSION = 1

/** 工程文件结构（.cad.json） */
export interface ProjectData {
  version: number
  layers: Layer[]
  entities: Entity[]
  activeLayerId: string
}

/** 序列化当前工程为 .cad.json 文本（图层 + 实体 + 当前图层） */
export function serializeProject(
  layers: Layer[],
  entities: Entity[],
  activeLayerId: string,
): string {
  const data: ProjectData = { version: PROJECT_VERSION, layers, entities, activeLayerId }
  return JSON.stringify(data, null, 2)
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 清洗工程文件中的实体列表（丢弃非法条目；标注数值按几何重算） */
function sanitizeEntities(raw: unknown[], layerIds: Set<string>): Entity[] {
  const out: Entity[] = []
  for (const item of raw) {
    const e = item as Record<string, unknown> | null
    if (!e || typeof e.id !== 'string' || e.id === '') continue
    const id = e.id
    const layerId =
      typeof e.layerId === 'string' && layerIds.has(e.layerId) ? e.layerId : DEFAULT_LAYER.id
    const color =
      typeof e.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : undefined
    const strokeWidth = num(e.strokeWidth)
    switch (e.type) {
      case 'line': {
        const s = e as unknown as Partial<LineEntity>
        const x1 = num(s.start?.x)
        const y1 = num(s.start?.y)
        const x2 = num(s.end?.x)
        const y2 = num(s.end?.y)
        if (x1 === null || y1 === null || x2 === null || y2 === null) continue
        out.push({
          id,
          type: 'line',
          layerId,
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          ...(color ? { color } : {}),
          ...(strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
        })
        break
      }
      case 'rect': {
        const s = e as unknown as Partial<RectEntity>
        const x = num(s.x)
        const y = num(s.y)
        const width = num(s.width)
        const height = num(s.height)
        if (x === null || y === null || width === null || height === null) continue
        out.push({
          id,
          type: 'rect',
          layerId,
          x,
          y,
          width,
          height,
          ...(color ? { color } : {}),
          ...(strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
        })
        break
      }
      case 'circle': {
        const s = e as unknown as Partial<CircleEntity>
        const cx = num(s.center?.x)
        const cy = num(s.center?.y)
        const radius = num(s.radius)
        if (cx === null || cy === null || radius === null || radius <= 0) continue
        out.push({
          id,
          type: 'circle',
          layerId,
          center: { x: cx, y: cy },
          radius,
          ...(color ? { color } : {}),
          ...(strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
        })
        break
      }
      case 'dimension': {
        const s = e as unknown as Partial<DimensionEntity>
        const x1 = num(s.start?.x)
        const y1 = num(s.start?.y)
        const x2 = num(s.end?.x)
        const y2 = num(s.end?.y)
        if (x1 === null || y1 === null || x2 === null || y2 === null) continue
        out.push({
          id,
          type: 'dimension',
          layerId,
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          offset: num(s.offset) ?? 0,
          value: Math.hypot(x2 - x1, y2 - y1), // 数值按几何重算，避免文件中的值失真
          ...(color ? { color } : {}),
        })
        break
      }
      case 'polyline': {
        const s = e as unknown as Partial<PolylineEntity>
        const rawPts = Array.isArray(s.points) ? s.points : []
        const pts: Point[] = []
        for (const p of rawPts) {
          const x = num(p?.x)
          const y = num(p?.y)
          if (x === null || y === null) {
            pts.length = 0
            break
          }
          pts.push({ x, y })
        }
        if (pts.length < 2) continue
        out.push({
          id,
          type: 'polyline',
          layerId,
          points: pts,
          closed: s.closed === true,
          ...(color ? { color } : {}),
          ...(strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
        })
        break
      }
      default:
        break
    }
  }
  return out
}

/** 解析 .cad.json（最小校验：JSON 结构、版本、图层与实体字段合法性） */
export function parseProject(text: string): ProjectData {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('不是有效的 JSON 文件')
  }
  if (!data || typeof data !== 'object') throw new Error('工程文件结构无效')
  const obj = data as Record<string, unknown>
  if (typeof obj.version !== 'number' || obj.version > PROJECT_VERSION) {
    throw new Error(`不支持的工程文件版本：${String(obj.version)}`)
  }
  const layers = sanitizeLayers(Array.isArray(obj.layers) ? obj.layers : [])
  const layerIds = new Set(layers.map(l => l.id))
  const entities = sanitizeEntities(Array.isArray(obj.entities) ? obj.entities : [], layerIds)
  const activeLayerId =
    typeof obj.activeLayerId === 'string' && layerIds.has(obj.activeLayerId)
      ? obj.activeLayerId
      : DEFAULT_LAYER.id
  return { version: PROJECT_VERSION, layers, entities, activeLayerId }
}

/* ------------------------------ DXF 导出 / 导入 ------------------------------ */

/** 基础 ACI 色表（DXF 颜色索引 → hex） */
const ACI_TO_HEX: Record<number, string> = {
  1: '#ff0000',
  2: '#ffff00',
  3: '#00ff00',
  4: '#00ffff',
  5: '#0000ff',
  6: '#ff00ff',
  7: '#ffffff',
  8: '#808080',
  9: '#c0c0c0',
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

/** hex → 最接近的基础 ACI 索引（无法解析时返回 7 白色） */
export function hexToAci(hex: string): number {
  const c = hexToRgb(hex)
  if (!c) return 7
  let best = 7
  let bestDist = Infinity
  for (const [aciStr, h] of Object.entries(ACI_TO_HEX)) {
    const p = hexToRgb(h)!
    const d = (c.r - p.r) ** 2 + (c.g - p.g) ** 2 + (c.b - p.b) ** 2
    if (d < bestDist) {
      bestDist = d
      best = Number(aciStr)
    }
  }
  return best
}

/** ACI → hex；ByBlock(0)/ByLayer(256)/未指定返回 null（由调用方解析图层颜色） */
export function aciToHex(aci: number | undefined): string | null {
  if (aci === undefined || aci === 0 || aci === 256) return null
  return ACI_TO_HEX[aci] ?? '#ffffff'
}

/**
 * 导出 DXF：图层表（ACI 近似色 + 真彩色 420）+ 实体
 * （直线→LINE、矩形→封闭 POLYLINE、圆→CIRCLE；标注不导出）。
 * DXF Y 轴向上、本应用世界 Y 轴向下，导出时 Y 取反保证视觉一致。
 */
export function exportDxf(layers: Layer[], entities: Entity[]): string {
  const drawing = new Drawing()
  const nameOf = (id: string) => layers.find(l => l.id === id)?.name ?? DEFAULT_LAYER.name
  for (const layer of layers) {
    drawing.addLayer(layer.name, hexToAci(layer.color), 'CONTINUOUS')
    const rgb = hexToRgb(layer.color)
    if (rgb) {
      // 真彩色（组码 420）：AutoCAD 等软件中呈现精确颜色
      drawing.setActiveLayer(layer.name)
      drawing.setTrueColor((rgb.r << 16) | (rgb.g << 8) | rgb.b)
    }
  }
  for (const e of entities) {
    drawing.setActiveLayer(nameOf(e.layerId))
    switch (e.type) {
      case 'line':
        drawing.drawLine(e.start.x, -e.start.y, e.end.x, -e.end.y)
        break
      case 'rect':
        drawing.drawPolyline(
          [
            [e.x, -e.y],
            [e.x + e.width, -e.y],
            [e.x + e.width, -(e.y + e.height)],
            [e.x, -(e.y + e.height)],
          ],
          true,
        )
        break
      case 'circle':
        drawing.drawCircle(e.center.x, -e.center.y, e.radius)
        break
      case 'polyline':
        drawing.drawPolyline(
          e.points.map(p => [p.x, -p.y] as [number, number]),
          e.closed,
        )
        break
      case 'dimension':
        break // 标注不导出（DXF 标注实体结构复杂，超出本阶段范围）
    }
  }
  return drawing.toDxfString()
}

/** 宽松的 DXF 实体视图（仅取导入所需的字段） */
interface RawEntity {
  type?: string
  layer?: string
  vertices?: { x: number; y: number }[]
  center?: { x: number; y: number }
  radius?: number
  shape?: boolean
}

/** (LW)POLYLINE → 实体：4 顶点封闭轴对齐 → 矩形；其余整体还原为多段线 */
function polylineToEntity(
  pts: { x: number; y: number }[],
  closed: boolean,
  layerId: string,
): Entity {
  // 部分软件导出封闭矩形时重复首点（5 点首尾重合）
  if (pts.length === 5 && pts[0].x === pts[4].x && pts[0].y === pts[4].y) {
    pts = pts.slice(0, 4)
  }
  const rect = rectFromPolyline(pts)
  if (rect) return { id: crypto.randomUUID(), type: 'rect', layerId, ...rect }
  return { id: crypto.randomUUID(), type: 'polyline', layerId, points: pts, closed }
}

/** 4 顶点封闭且轴对齐的多段线视为矩形，返回其几何（否则 null） */
function rectFromPolyline(
  pts: { x: number; y: number }[],
): { x: number; y: number; width: number; height: number } | null {
  if (pts.length !== 4) return null
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  if (x0 === x1 || y0 === y1) return null
  const keys = new Set(pts.map(p => `${p.x},${p.y}`))
  if (keys.size !== 4) return null
  const corners = [`${x0},${y0}`, `${x0},${y1}`, `${x1},${y0}`, `${x1},${y1}`]
  if (!corners.every(k => keys.has(k))) return null
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/**
 * 导入 DXF：解析 ENTITIES 节的 LINE / CIRCLE / (LW)POLYLINE（Y 轴翻转还原），
 * 并从图层表还原图层名称与颜色。不支持的实体类型（ARC/SPLINE/TEXT 等）跳过。
 * 图层 id 沿用 DXF 图层名；与现有图层同名时由 mergeLayers 去重合并。
 */
export function parseDxf(text: string): { entities: Entity[]; layers: Layer[] } {
  const dxf = new DxfParser().parseSync(text)
  if (!dxf) throw new Error('DXF 文件解析失败（文件为空或格式无效）')
  const rawEntities = dxf.entities as unknown as RawEntity[]
  const layerTable = (dxf.tables?.layer?.layers ?? {}) as Record<
    string,
    { name?: string; color?: number }
  >

  const entities: Entity[] = []
  const layerNames = new Set<string>()
  for (const raw of rawEntities) {
    const layerName =
      typeof raw.layer === 'string' && raw.layer !== '' ? raw.layer : DEFAULT_LAYER.id
    layerNames.add(layerName)
    switch (raw.type) {
      case 'LINE': {
        const v = raw.vertices
        if (!v || v.length < 2 || !v[0] || !v[1]) break
        entities.push({
          id: crypto.randomUUID(),
          type: 'line',
          layerId: layerName,
          start: { x: v[0].x, y: -v[0].y },
          end: { x: v[1].x, y: -v[1].y },
        })
        break
      }
      case 'CIRCLE': {
        const c = raw.center
        if (!c || typeof raw.radius !== 'number' || !Number.isFinite(raw.radius)) break
        entities.push({
          id: crypto.randomUUID(),
          type: 'circle',
          layerId: layerName,
          center: { x: c.x, y: -c.y },
          radius: raw.radius,
        })
        break
      }
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const pts = raw.vertices
        if (!pts || pts.length < 2) break
        entities.push(
          polylineToEntity(
            pts.map(p => ({ x: p.x, y: -p.y })),
            raw.shape === true,
            layerName,
          ),
        )
        break
      }
      default:
        break
    }
  }

  // 图层：沿用 DXF 图层名与图层表颜色（'0' 层缺失时以默认层兜底）
  const layers = sanitizeLayers(
    [...layerNames].map(name => ({
      id: name,
      name,
      color: aciToHex(layerTable[name]?.color) ?? '#ffffff',
      strokeWidth: 2,
      visible: true,
      locked: false,
    })),
  )
  return { entities, layers }
}

/** 图层模型 */
export interface Layer {
  /** 图层唯一 id（默认图层为 '0'） */
  id: string
  /** 图层名称 */
  name: string
  /** 图层颜色：未单独指定颜色的实体渲染时跟随此颜色（改色自动同步） */
  color: string
  /** 图层线宽：未单独指定线宽的实体渲染时跟随此线宽 */
  strokeWidth: number
  /** 是否可见（false 时该层实体不渲染） */
  visible: boolean
  /** 是否锁定（true 时该层实体不可选中 / 拖拽 / 删除） */
  locked: boolean
}

/** 默认图层 '0'：不可删除 */
export const DEFAULT_LAYER: Layer = {
  id: '0',
  name: '0',
  color: '#ffffff',
  strokeWidth: 2,
  visible: true,
  locked: false,
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * 清洗外部图层数据（工程文件 / DXF 导入）：
 * 丢弃非法条目、按 id 去重、缺失字段补默认值，并确保存在 '0' 层。
 */
export function sanitizeLayers(raw: unknown[]): Layer[] {
  const seen = new Set<string>()
  const out: Layer[] = []
  for (const item of raw) {
    const l = item as Partial<Layer> | null
    if (!l || typeof l.id !== 'string' || l.id === '' || seen.has(l.id)) continue
    seen.add(l.id)
    out.push({
      id: l.id,
      name: typeof l.name === 'string' && l.name !== '' ? l.name : l.id,
      color: typeof l.color === 'string' && HEX_COLOR.test(l.color) ? l.color : DEFAULT_LAYER.color,
      strokeWidth:
        typeof l.strokeWidth === 'number' &&
        Number.isFinite(l.strokeWidth) &&
        l.strokeWidth > 0
          ? l.strokeWidth
          : DEFAULT_LAYER.strokeWidth,
      visible: l.visible !== false,
      locked: l.locked === true,
    })
  }
  if (!seen.has(DEFAULT_LAYER.id)) out.unshift({ ...DEFAULT_LAYER })
  return out
}

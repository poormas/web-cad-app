import { useEntityStore } from '../state/useEntityStore'
import { useLayerStore } from '../state/useLayerStore'
import { exportDxf, parseDxf, parseProject, serializeProject } from './cadFile'

/** 触发浏览器下载文本文件 */
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 保存当前工程为 .cad.json（Ctrl+S / 顶部菜单共用） */
export function saveProjectFile() {
  const { entities } = useEntityStore.getState()
  const { layers, activeLayerId } = useLayerStore.getState()
  downloadFile(
    serializeProject(layers, entities, activeLayerId),
    'project.cad.json',
    'application/json',
  )
}

/** 打开 .cad.json 并整体载入（Ctrl+O / 顶部菜单共用；动态创建文件选择框） */
export function openProjectFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.cad.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    void file.text().then(text => {
      try {
        const data = parseProject(text)
        useLayerStore.getState().loadLayers(data.layers, data.activeLayerId)
        useEntityStore.getState().loadEntities(data.entities)
      } catch (err) {
        window.alert(`工程文件打开失败：${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }
  input.click()
}

/** 导出 DXF 并触发下载（顶部菜单） */
export function exportDxfFile() {
  const { entities } = useEntityStore.getState()
  const { layers } = useLayerStore.getState()
  downloadFile(exportDxf(layers, entities), 'project.dxf', 'application/dxf')
}

/** 导入 DXF：合并图层 + 追加实体（顶部菜单；动态创建文件选择框） */
export function importDxfFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.dxf'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    void file.text().then(text => {
      try {
        const { entities, layers } = parseDxf(text)
        useLayerStore.getState().mergeLayers(layers)
        useEntityStore.getState().addEntities(entities)
        window.alert(`DXF 导入成功：${entities.length} 个图元`)
      } catch (err) {
        window.alert(`DXF 导入失败：${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }
  input.click()
}

import { Download, FilePlus, FolderOpen, Save, Upload } from 'lucide-react'
import { useEditorStore } from '../../core/state/useEditorStore'
import { useEntityStore } from '../../core/state/useEntityStore'
import { useLayerStore } from '../../core/state/useLayerStore'
import {
  exportDxfFile,
  importDxfFile,
  openProjectFile,
  saveProjectFile,
} from '../../core/io/cadActions'

const btn =
  'flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white'

/**
 * 顶部菜单栏（毛玻璃深色面板，居中悬浮）：
 * 新建工程（弹窗确认）/ 打开·保存 .cad.json（Ctrl+O / Ctrl+S）/ 导入·导出 DXF。
 * 文件动作统一委托 cadActions，与全局快捷键共用同一实现。
 */
export default function TopNavBar() {
  /** 新建工程：清空画布、重置图层与视图（弹窗确认） */
  const handleNew = () => {
    if (!window.confirm('新建工程将清空当前画布与图层，确定继续？')) return
    const editor = useEditorStore.getState()
    editor.cancelDraft()
    editor.cancelMeasure()
    editor.clearEdit()
    editor.setSelectedIds([])
    editor.fitView()
    useEntityStore.getState().loadEntities([])
    useLayerStore.getState().resetLayers()
  }

  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-slate-900/60 p-1.5 shadow-2xl backdrop-blur-md">
      <button type="button" title="新建工程（清空画布与图层）" onClick={handleNew} className={btn}>
        <FilePlus size={16} />
        新建
      </button>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <button
        type="button"
        title="打开工程文件 (.cad.json) —— Ctrl+O"
        onClick={openProjectFile}
        className={btn}
      >
        <FolderOpen size={16} />
        打开
      </button>
      <button
        type="button"
        title="保存工程文件 (.cad.json) —— Ctrl+S"
        onClick={saveProjectFile}
        className={btn}
      >
        <Save size={16} />
        保存
      </button>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <button type="button" title="导入 DXF 文件" onClick={importDxfFile} className={btn}>
        <Upload size={16} />
        导入 DXF
      </button>
      <button type="button" title="导出 DXF 文件" onClick={exportDxfFile} className={btn}>
        <Download size={16} />
        导出 DXF
      </button>
    </div>
  )
}

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // konva + DXF 解析/写出依赖体积较大（gzip 后约 180KB），
    // 单页 CAD 应用按整包交付不拆包，调高告警阈值以保证生产构建零警告
    chunkSizeWarningLimit: 800,
  },
})

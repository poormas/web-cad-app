import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径基准：产物可从任意子路径（如 GitHub Pages 的 /<repo>/）加载，
  // 无需在构建时指定部署路径；index.html 中的资源引用将变为 ./assets/...
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // konva + DXF 解析/写出依赖体积较大（gzip 后约 180KB），
    // 单页 CAD 应用按整包交付不拆包，调高告警阈值以保证生产构建零警告
    chunkSizeWarningLimit: 800,
  },
})

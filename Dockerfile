# ============================================================
# web-cad-app 生产镜像：多阶段构建
# Stage 1 —— 编译：node:20-alpine 安装依赖并产出静态产物 dist/
# Stage 2 —— 托管：nginx:alpine-slim 提供静态服务
# ============================================================

# ---------- Stage 1: 构建 ----------
FROM node:20-alpine AS build
WORKDIR /app

# 先拷贝依赖清单，利用 Docker 层缓存（依赖不变时跳过 npm ci）
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并执行生产构建（tsc -b && vite build，产物在 dist/）
COPY . .
RUN npm run build

# ---------- Stage 2: 运行 ----------
FROM nginx:alpine-slim

# 静态产物
COPY --from=build /app/dist /usr/share/nginx/html
# 站点配置（Gzip / SPA 回退 / 静态资源缓存策略）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

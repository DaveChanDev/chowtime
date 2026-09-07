# ==============================================================================
# Stage 1: 前端静态资源构建 (Node 20 Alpine)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: PocketBase 超轻量单容器 (Alpine Linux)
# ==============================================================================
FROM alpine:3.19 AS runner

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG PB_VERSION=0.39.8

WORKDIR /pb

# 安装基础依赖与下载 PocketBase 官方多架构二进制
RUN apk add --no-cache ca-certificates wget unzip curl && \
    wget -O /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${TARGETOS}_${TARGETARCH}.zip && \
    unzip /tmp/pb.zip -d /pb && \
    rm /tmp/pb.zip && \
    chmod +x /pb/pocketbase

# 复制 PocketBase 数据模型迁移脚本
COPY pb_migrations/ /pb/pb_migrations/

# 复制初始预置菜谱库与食材图片 (无任何管理员账号及个人记录，开箱即用)
COPY pb_data/ /pb/pb_data/

# 复制前端编译产物至 PocketBase 静态托管目录
COPY --from=frontend-builder /app/frontend/dist/ /pb/pb_public/

EXPOSE 8090

VOLUME ["/pb/pb_data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8090/api/health || exit 1

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public"]

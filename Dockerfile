# 使用官方 Node.js 18 镜像作为基础镜像
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 构建阶段
FROM base AS builder
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci

# 复制源代码
COPY . .

# 确保必要的目录存在
RUN mkdir -p public/characters && \
    mkdir -p data/public/characters

# 允许在构建期注入前端并发配置（NEXT_PUBLIC_* 会被 Next 内联）
ARG NEXT_PUBLIC_BATCH_UPLOAD_CONCURRENCY=3
ENV NEXT_PUBLIC_BATCH_UPLOAD_CONCURRENCY=${NEXT_PUBLIC_BATCH_UPLOAD_CONCURRENCY}

# 构建应用 - 禁用缓存确保每次都重新构建
RUN npm run build --no-cache

# 生产阶段
FROM base AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 创建数据目录
RUN mkdir -p /app/data/public/characters && \
    mkdir -p /app/public/characters

# 复制 public 目录
COPY --from=builder /app/public ./public

# 复制初始化脚本
COPY scripts/init.sh ./init.sh

# 设置权限
RUN chown -R nextjs:nodejs /app/data && \
    chown -R nextjs:nodejs /app/public && \
    chmod -R 755 /app/public/characters && \
    chmod -R 755 /app/data/public/characters && \
    chmod +x /app/init.sh

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["./init.sh"]

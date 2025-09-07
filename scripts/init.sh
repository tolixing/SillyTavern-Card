#!/bin/sh

# 创建必要的目录（数据目录与公开目录）
mkdir -p /app/public/characters
mkdir -p /app/data/public/characters

# 如数据目录下不存在 index.json，则用镜像内的 public/index.json 初始化（若存在）
if [ ! -f "/app/data/public/index.json" ]; then
  if [ -f "/app/public/index.json" ]; then
    mkdir -p /app/data/public
    cp /app/public/index.json /app/data/public/index.json
  else
    # 若镜像未包含 index.json，则写入一个空索引
    mkdir -p /app/data/public
    echo '{"repository_version":"1.0.0","last_updated":"'"$(date -u +%FT%TZ)"'","characters":[]}' > /app/data/public/index.json
  fi
fi

# 设置权限
chmod -R 755 /app/public
chmod -R 755 /app/data

# 启动应用
exec node server.js

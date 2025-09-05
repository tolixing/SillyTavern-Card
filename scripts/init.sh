#!/bin/sh

# 创建必要的目录
mkdir -p /app/public/characters
mkdir -p /app/data/characters

# 设置权限
chmod -R 755 /app/public
chmod -R 755 /app/data

# 启动应用
exec node server.js

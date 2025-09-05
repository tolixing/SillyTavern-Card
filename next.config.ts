import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用输出独立模式，用于 Docker 部署
  output: 'standalone',
  
  // 图像优化配置
  images: {
    // 允许本地文件系统图像
    unoptimized: true,
    // 允许本地域名
    domains: ['localhost'],
    // 移除 Vercel Blob 远程模式，使用本地文件
    remotePatterns: [],
  },
  
  // 服务器外部包
  serverExternalPackages: [],
  
  // 环境变量
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;

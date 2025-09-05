# SillyTavern 角色卡中心

一个现代化的角色卡管理平台，专为 SillyTavern 用户设计。支持角色卡的上传、管理、编辑和分享。

## ✨ 功能特性

### 🎭 角色卡管理
- **智能上传**：支持 PNG 格式角色卡，自动解析元数据信息
- **可视化展示**：美观的卡片式布局，全图背景展示
- **一键编辑**：弹窗式编辑界面，支持信息修改和文件替换
- **批量操作**：支持角色卡的删除和批量管理

### 🎨 用户界面
- **现代化设计**：采用 Tailwind CSS，响应式布局
- **动态模糊效果**：底部信息区域使用渐变背景和模糊效果
- **流畅动画**：悬停放大、过渡动画等交互效果
- **弹窗交互**：上传、编辑、详情查看均采用弹窗模式

### 🔍 搜索和筛选
- **实时搜索**：支持按角色名称、描述、标签搜索
- **详情查看**：点击角色卡查看完整信息
- **版本管理**：显示角色卡版本信息

### 📱 响应式支持
- **多端适配**：支持桌面端、平板、手机等不同屏幕尺寸
- **触控友好**：优化触控设备的交互体验

## 🚀 技术栈

- **前端框架**：Next.js 15 (App Router)
- **UI 框架**：Tailwind CSS 4
- **开发语言**：TypeScript
- **图像处理**：Sharp (Next.js Image 优化)
- **构建工具**：Turbopack
- **容器化**：Docker & Docker Compose
- **反向代理**：Nginx

## 📦 快速开始

### 环境要求

- Node.js 18+ 
- Docker & Docker Compose
- npm 或 yarn 或 pnpm

### 本地开发

1. **克隆项目**
```bash
git clone <your-repository-url>
cd SillyTavern-Card
```

2. **安装依赖**
```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. **启动开发服务器**
```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

4. **访问应用**
打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 🐳 Docker 部署

### 快速开始

1. **克隆项目**
```bash
git clone https://github.com/tolixing/SillyTavern-Card.git
cd sillytavern-card
```

2. **使用预构建镜像启动服务**
```bash
# 直接使用预构建镜像启动
docker-compose up -d
```

3. **访问应用**
- 应用地址：http://localhost:3000

### 管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新服务
docker-compose pull && docker-compose up -d
```

### 数据持久化

项目数据会保存在以下目录：
- `./data/` - 应用数据
- `./public/characters/` - 角色卡文件

### 详细使用说明

更多 Docker 使用说明请参考：[Docker 使用指南](./doc/docker-usage.md)

## 📁 项目结构

```
sillytavern-card/
├── src/
│   ├── app/
│   │   ├── components/          # React 组件
│   │   │   ├── UploadModal.tsx  # 上传弹窗
│   │   │   └── EditModal.tsx    # 编辑弹窗
│   │   ├── api/                 # API 路由
│   │   │   ├── upload/          # 上传 API
│   │   │   ├── characters/      # 角色管理 API
│   │   │   ├── files/           # 文件服务 API
│   │   │   └── index/           # 索引 API
│   │   ├── lib/                 # 工具库
│   │   │   └── storage.ts       # 存储适配器
│   │   ├── globals.css          # 全局样式
│   │   ├── layout.tsx           # 根布局
│   │   └── page.tsx             # 主页面
├── public/
│   ├── characters/              # 角色卡文件存储
│   └── index.json               # 角色索引文件
├── .github/workflows/           # GitHub Actions
│   └── docker-build.yml         # Docker 构建工作流
├── doc/                         # 文档
├── data/                        # 数据目录（Docker 部署）
├── docker-compose.yml           # Docker Compose 配置
├── Dockerfile                   # Docker 镜像构建文件
├── package.json
├── next.config.ts               # Next.js 配置
└── tsconfig.json                # TypeScript 配置
```

## 🔧 配置说明

### Next.js 配置

项目使用 Next.js 15 的 App Router，支持：
- 服务端渲染 (SSR)
- 静态生成 (SSG)
- API 路由
- 图像优化
- 独立输出模式（Docker 部署）

### Docker 配置

- **多阶段构建**：优化镜像大小
- **非 root 用户**：提高安全性
- **数据持久化**：使用卷挂载
- **预构建镜像**：使用 GitHub Container Registry

## 📖 API 文档

### 角色卡上传
```
POST /api/upload
Content-Type: multipart/form-data

参数：
- file: PNG 格式的角色卡文件
- name: 角色名称
- version: 版本号
- description: 描述信息
```

### 角色卡管理
```
PUT /api/characters/[id]     # 更新角色卡
DELETE /api/characters/[id]  # 删除角色卡
```

### 角色索引
```
GET /api/index               # 获取所有角色卡列表
```

### 文件服务
```
GET /api/files/[...path]     # 获取角色卡文件
```

详细 API 文档请参考：[API_DOC.md](./API_DOC.md)

## 🔒 安全考虑

### 文件上传安全
- 文件类型验证（仅 PNG）
- 文件大小限制（50MB）
- 路径遍历防护
- 恶意文件检测

### 访问控制
- API 请求频率限制
- 文件访问权限控制
- 敏感信息保护

### 数据备份
- 定期自动备份
- 增量备份策略
- 异地备份方案

## 🚨 故障排除

### 常见问题

1. **应用无法启动**
   ```bash
   # 检查 Docker 服务状态
   docker-compose ps
   
   # 查看错误日志
   docker-compose logs app
   ```

2. **文件上传失败**
   - 检查文件大小是否超过限制
   - 确认文件格式为 PNG
   - 检查磁盘空间是否充足

3. **图片无法显示**
   - 检查文件路径是否正确
   - 确认文件服务 API 是否正常
   - 检查数据目录权限

4. **性能问题**
   - 检查服务器资源使用情况
   - 检查磁盘空间
   - 考虑使用 CDN

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看应用日志
docker-compose logs -f app

# 查看实时日志
docker-compose logs --tail=100 -f
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

### v2.0.0
- 🐳 新增 Docker 容器化部署
- ⚡ 优化上传响应速度（从 3-5秒 降至 0.5-1秒）
- 🗂️ 重构存储架构，移除 Vercel Blob 依赖
- 📚 完善部署文档和脚本
- 🚀 配置 GitHub Actions 自动构建 Docker 镜像
- 🛡️ 增强安全性和稳定性

### v1.0.0
- ✨ 初始版本发布
- 🎭 支持角色卡上传、编辑、删除
- 🎨 现代化 UI 设计
- 📱 响应式布局支持
- 🔍 搜索和筛选功能

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Docker](https://www.docker.com/) - 容器化平台
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 角色卡格式标准

---

**🌟 如果这个项目对你有帮助，请给个 Star！**
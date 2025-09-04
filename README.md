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

## 📦 快速开始

### 环境要求

- Node.js 18+ 
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

## 🌐 部署到 Vercel

### 方法一：通过 GitHub（推荐）

1. **准备代码仓库**
   - 将代码推送到 GitHub 仓库
   - 确保 `package.json` 和构建配置正确

2. **连接 Vercel**
   - 访问 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "New Project"
   - 选择你的 GitHub 仓库
   - Vercel 会自动检测 Next.js 项目

3. **配置项目**
   ```
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

4. **环境变量配置**
   - 在 Vercel Dashboard 中设置环境变量
   - **必需的环境变量**：
     ```
     BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
     ```
   - 获取 Blob Token：
     - 访问 Vercel Dashboard
     - 进入项目设置 → Storage
     - 创建 Blob Store
     - 复制 Read/Write Token

5. **部署**
   - 点击 "Deploy" 开始部署
   - 部署完成后获得生产环境 URL

### ⚠️ 重要说明

**Vercel Blob 存储配置**：
- 本项目使用 Vercel Blob 存储来保存上传的角色卡文件
- 在部署前必须配置 `BLOB_READ_WRITE_TOKEN` 环境变量
- 本地开发时文件保存在 `public/characters/` 目录
- 生产环境时文件保存在 Vercel Blob 存储中

### 方法二：通过 Vercel CLI

1. **安装 Vercel CLI**
```bash
npm i -g vercel
```

2. **登录 Vercel**
```bash
vercel login
```

3. **部署项目**
```bash
# 在项目根目录执行
vercel

# 生产环境部署
vercel --prod
```

### 自动部署配置

Vercel 支持 Git 集成，每次推送到主分支时自动部署：

1. **推送触发部署**
   - 推送到 `main` 分支自动部署到生产环境
   - 推送到其他分支创建预览部署

2. **部署状态检查**
   - 在 Vercel Dashboard 查看部署状态
   - 支持构建日志和错误调试

## 📁 项目结构

```
SillyTavern-Card/
├── src/
│   ├── app/
│   │   ├── components/          # React 组件
│   │   │   ├── UploadModal.tsx  # 上传弹窗
│   │   │   └── EditModal.tsx    # 编辑弹窗
│   │   ├── api/                 # API 路由
│   │   │   ├── upload/          # 上传 API
│   │   │   └── characters/      # 角色管理 API
│   │   ├── globals.css          # 全局样式
│   │   ├── layout.tsx           # 根布局
│   │   └── page.tsx             # 主页面
├── public/
│   ├── characters/              # 角色卡文件存储
│   └── index.json               # 角色索引文件
├── doc/                         # 文档
├── package.json
├── next.config.ts               # Next.js 配置
├── tailwind.config.ts           # Tailwind 配置
└── tsconfig.json                # TypeScript 配置
```

## 🔧 配置说明

### Next.js 配置

项目使用 Next.js 15 的 App Router，支持：
- 服务端渲染 (SSR)
- 静态生成 (SSG)
- API 路由
- 图像优化

### Tailwind CSS

使用 Tailwind CSS 4 提供：
- 响应式设计
- 现代 UI 组件
- 动画和过渡效果
- 暗色模式支持（可扩展）

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
GET /index.json              # 获取所有角色卡列表
```

详细 API 文档请参考：[API_DOC.md](./API_DOC.md)

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

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
- [Vercel](https://vercel.com/) - 部署平台
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 角色卡格式标准

---

**🌟 如果这个项目对你有帮助，请给个 Star！**
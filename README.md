# Multi-Agent Content Pipeline

AI 短剧自动生产流水线（脚本 → 分镜 → 生成 → 合成）

[![Deploy Demo](https://github.com/kevin-claw-agent/content-pipeline/actions/workflows/pages.yml/badge.svg)](https://github.com/kevin-claw-agent/content-pipeline/actions/workflows/pages.yml)

## 🎬 在线演示

**[访问演示网站](https://kevin-claw-agent.github.io/content-pipeline/)**

演示网站包含：
- 📊 项目架构展示
- 🚀 在线创建 Episode
- 📈 实时流水线进度监控
- 📚 预置示例库

## 架构

```
User Request → API → Orchestrator → BullMQ → Workers → Output
                    ↓
              PostgreSQL (State)
                    ↓
              S3/MinIO (Assets)
```

## 阶段
1. **ScriptAgent**: 故事梗概 → 完整脚本
2. **VisualAgent**: 脚本 → 分镜描述
3. **RenderAgent**: 分镜 → 视频片段
4. **Composer**: 片段 → 最终视频

## 数据模型
- `episodes`: 整体项目
- `jobs`: 各阶段任务
- `assets`: 生成的资源文件
- `model_calls`: 模型调用记录

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- Docker & Docker Compose

### 安装与启动

```bash
# Clone 仓库
git clone https://github.com/kevin-claw-agent/content-pipeline.git
cd content-pipeline

# 启动依赖服务（PostgreSQL, Redis, MinIO）
docker-compose -f docker/docker-compose.yml up -d

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 配置你的 API Keys

# 启动 API 服务
npm run dev

# 启动所有 Worker（在新终端窗口）
npm run workers
```

### API 使用示例

```bash
# 创建 Episode
curl -X POST http://localhost:3000/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "我的短剧",
    "premise": "一个关于勇气的故事...",
    "targetDuration": 30
  }'

# 查询状态
curl http://localhost:3000/episodes/{episode-id}
```

## 📁 项目结构

```
content-pipeline/
├── demo/                   # 演示网站
│   ├── index.html         # 首页
│   ├── app.js             # 交互逻辑
│   ├── assets/            # 样式和资源
│   └── examples/          # 示例数据
├── src/
│   ├── api/               # Express API
│   ├── workers/           # 各阶段 Worker
│   ├── orchestrator/      # 任务调度
│   ├── storage/           # 存储抽象
│   ├── utils/             # 工具函数
│   └── config/            # 配置
├── test/                  # 测试文件
├── docker/                # Docker 配置
├── docs/                  # 文档
├── screenshots/           # 演示截图
└── examples/              # 示例数据
```

## 🛠 技术栈

- **Runtime**: Node.js + TypeScript
- **API**: Express.js
- **Queue**: BullMQ (Redis)
- **Database**: PostgreSQL
- **Storage**: MinIO / AWS S3
- **Container**: Docker + Docker Compose

## 🧪 测试

```bash
# 运行所有测试
npm test

# 覆盖率报告
npm run test:coverage

#  watch 模式
npm run test:watch
```

## 🌿 Branch Strategy

We use GitFlow branching model:

```
master     ← production releases (stable)
  ↑
develop    ← integration branch (latest features)
  ↑
test       ← staging environment
  ↑
feature/*  ← individual features
```

- **master**: Production-ready code, protected branch
- **develop**: Integration branch for features
- **test**: Staging environment for pre-production testing
- **feature/**: New features (branch from develop)
- **bugfix/**: Bug fixes
- **hotfix/**: Critical production fixes

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed workflow.

## 🚀 CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CI | PR to develop/master | Lint, type-check, test |
| Test Suite | Push to develop/test/master | Unit & integration tests |
| Release | Tag push | Build, push image, create release |
| Deploy Staging | Merge to test | Deploy to staging |
| Deploy Production | Tag push | Deploy to production |

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) - System architecture details
- [API Reference](docs/API.md) - API documentation
- [Deployment](docs/DEPLOYMENT.md) - Deployment guide
- [Contributing](CONTRIBUTING.md) - Contribution guidelines
- [Release Process](RELEASE.md) - How to create releases

## 📝 License

MIT

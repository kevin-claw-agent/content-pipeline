# Multi-Agent Content Pipeline

AI 短剧自动生产流水线（脚本 → 分镜 → 生成 → 合成）

## 架构

```
User Request → API → Orchestrator → BullMQ → Workers → Output
                    ↓
              PostgreSQL (State)
                    ↓
              S3/MinIO (Assets)
```

## 阶段
1. ScriptAgent: 故事梗概 → 完整脚本
2. VisualAgent: 脚本 → 分镜描述
3. RenderAgent: 分镜 → 视频片段
4. Composer: 片段 → 最终视频

## 数据模型
- episodes: 整体项目
- jobs: 各阶段任务
- assets: 生成的资源文件
- model_calls: 模型调用记录

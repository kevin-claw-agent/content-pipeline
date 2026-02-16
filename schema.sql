-- Multi-Agent Content Pipeline Database Schema

-- Episodes table: 整体短剧项目
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    premise TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    target_duration INTEGER DEFAULT 30, -- 目标时长(秒)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Jobs table: 各阶段任务
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- script, storyboard, render, compose
    status VARCHAR(50) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Assets table: 生成的资源文件
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- script, image, video, audio
    uri VARCHAR(500) NOT NULL, -- S3/MinIO path
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model calls table: 模型调用记录(成本追踪)
CREATE TABLE IF NOT EXISTS model_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    provider VARCHAR(100) NOT NULL, -- openai, anthropic, local
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd DECIMAL(10, 6),
    latency_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_jobs_episode ON jobs(episode_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_assets_episode ON assets(episode_id);

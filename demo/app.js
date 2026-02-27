/**
 * Content Pipeline Demo Application
 * 交互逻辑：表单提交、进度轮询、示例加载
 */

// API 基础配置
const API_BASE_URL = localStorage.getItem('apiUrl') || 'http://localhost:3000';

// 示例数据
const EXAMPLES = {
    romance: {
        title: '咖啡馆奇缘',
        premise: '两个陌生人，Alex 和 Jordan，在一家温馨的咖啡馆相遇，当他们同时伸手去拿公共书架上的一本书。他们发现彼此都喜欢同一本冷门小说，整个下午都在喝咖啡讨论书籍，完全忘记了原来的计划。',
        targetDuration: 45
    },
    mystery: {
        title: '午夜来电',
        premise: 'Sarah 在凌晨三点接到一个陌生号码的电话，对方声称是她失踪三个月的邻居 Mr. Chen。电话那头传来微弱的声音："他们来找我了，小心镜子..." 电话突然中断，Sarah 看向墙上的镜子，发现镜中的自己正对着她微笑。',
        targetDuration: 60
    },
    scifi: {
        title: '最后一秒',
        premise: '时间旅行者 Kael 回到 2024 年，试图阻止一场毁灭性的灾难。他只有 60 秒的时间，每次失败都会重置。第 47 次尝试时，他终于发现真正的敌人是...未来的自己。',
        targetDuration: 60
    },
    comedy: {
        title: '狗狗大作战',
        premise: '当主人出门上班后，家里的两只狗狗 —— 聪明的边牧 Max 和憨厚的金毛 Duke —— 开始了他们的秘密计划：偷吃冰箱顶层的牛排。但他们必须躲过监控摄像头和智能门锁。',
        targetDuration: 45
    },
    horror: {
        title: '镜中人',
        premise: 'Lily 搬进了一栋百年老宅。每晚午夜，她都会听到阁楼传来脚步声。某天她鼓起勇气上去查看，发现一面古老的镜子。当她看向镜子时，里面的"自己"缓缓抬起手，指向她的身后...',
        targetDuration: 60
    }
};

// DOM 元素
const elements = {
    title: document.getElementById('episodeTitle'),
    premise: document.getElementById('episodePremise'),
    duration: document.getElementById('targetDuration'),
    startBtn: document.getElementById('startBtn'),
    progressPanel: document.getElementById('progressPanel'),
    resultPanel: document.getElementById('resultPanel'),
    previewPanel: document.getElementById('previewPanel'),
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    episodeId: document.getElementById('episodeId'),
    previewContent: document.getElementById('previewContent'),
    toast: document.getElementById('toast'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn')
};

// 状态
let currentEpisodeId = null;
let pollInterval = null;

/**
 * 初始化
 */
function init() {
    bindEvents();
    checkApiHealth();
}

/**
 * 绑定事件
 */
function bindEvents() {
    // 开始生成按钮
    elements.startBtn.addEventListener('click', handleStart);
    
    // 示例卡片点击
    document.querySelectorAll('.example-card').forEach(card => {
        card.addEventListener('click', () => {
            const exampleKey = card.dataset.example;
            loadExample(exampleKey);
        });
    });
    
    // 移动端菜单
    elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    // 结果面板按钮
    document.getElementById('newEpisodeBtn')?.addEventListener('click', resetDemo);
    document.getElementById('viewAssetsBtn')?.addEventListener('click', () => {
        if (currentEpisodeId) {
            window.open(`${API_BASE_URL}/episodes/${currentEpisodeId}/assets`, '_blank');
        }
    });
    
    // 复制代码按钮
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.clipboard;
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制到剪贴板！');
            });
        });
    });
    
    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

/**
 * 检查 API 健康状态
 */
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ API 连接正常');
        } else {
            showToast('⚠️ API 服务可能不可用，请确保后端服务已启动', 5000);
        }
    } catch (error) {
        console.warn('API 健康检查失败:', error);
        showToast('⚠️ 无法连接到 API，请确保后端服务运行在 localhost:3000', 5000);
    }
}

/**
 * 加载示例
 */
function loadExample(key) {
    const example = EXAMPLES[key];
    if (!example) return;
    
    elements.title.value = example.title;
    elements.premise.value = example.premise;
    elements.duration.value = example.targetDuration;
    
    // 滚动到演示区域
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
    
    showToast(`已加载示例：${example.title}`);
}

/**
 * 处理开始生成
 */
async function handleStart() {
    const premise = elements.premise.value.trim();
    
    if (!premise) {
        showToast('请输入故事梗概！', 3000);
        elements.premise.focus();
        return;
    }
    
    const data = {
        title: elements.title.value.trim() || undefined,
        premise: premise,
        targetDuration: parseInt(elements.duration.value) || 30
    };
    
    try {
        elements.startBtn.disabled = true;
        elements.startBtn.innerHTML = '<span class="spinner"></span> 创建中...';
        
        const response = await fetch(`${API_BASE_URL}/episodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const episode = await response.json();
        currentEpisodeId = episode.id;
        
        showProgressPanel(episode);
        startPolling(episode.id);
        
    } catch (error) {
        console.error('创建 Episode 失败:', error);
        showToast('❌ 创建失败，请确保 API 服务已启动', 5000);
        elements.startBtn.disabled = false;
        elements.startBtn.innerHTML = '<span class="btn-icon">🚀</span> 开始生成';
    }
}

/**
 * 显示进度面板
 */
function showProgressPanel(episode) {
    elements.episodeId.textContent = `ID: ${episode.id.slice(0, 8)}...`;
    elements.progressPanel.classList.remove('hidden');
    elements.resultPanel.classList.add('hidden');
    
    // 重置进度显示
    updateProgress(0);
    resetStageStatus();
    
    // 滚动到进度面板
    elements.progressPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 开始轮询进度
 */
function startPolling(episodeId) {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    pollInterval = setInterval(() => checkStatus(episodeId), 2000);
    // 立即检查一次
    checkStatus(episodeId);
}

/**
 * 检查 Episode 状态
 */
async function checkStatus(episodeId) {
    try {
        const response = await fetch(`${API_BASE_URL}/episodes/${episodeId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        updateUI(data);
        
        // 检查是否完成
        const status = data.episode?.status;
        if (status === 'completed' || status === 'failed') {
            clearInterval(pollInterval);
            pollInterval = null;
            
            if (status === 'completed') {
                showResultPanel();
            }
            
            // 重置按钮
            elements.startBtn.disabled = false;
            elements.startBtn.innerHTML = '<span class="btn-icon">🚀</span> 开始生成';
        }
        
    } catch (error) {
        console.error('获取状态失败:', error);
    }
}

/**
 * 更新 UI
 */
function updateUI(data) {
    const { episode, jobs, assets } = data;
    
    // 计算进度
    const stageOrder = ['script', 'storyboard', 'render', 'compose'];
    let completedStages = 0;
    
    jobs.forEach(job => {
        const stage = job.stage;
        const status = job.status;
        
        if (stageOrder.includes(stage)) {
            updateStageStatus(stage, status);
            if (status === 'completed') {
                completedStages++;
            }
        }
    });
    
    // 更新整体进度
    const progress = (completedStages / stageOrder.length) * 100;
    updateProgress(progress);
    
    // 更新预览内容
    if (assets.length > 0) {
        updatePreview(assets, jobs);
    }
}

/**
 * 更新阶段状态
 */
function updateStageStatus(stage, status) {
    const stageItem = document.querySelector(`.stage-item[data-stage="${stage}"]`);
    if (!stageItem) return;
    
    const statusEl = stageItem.querySelector('.stage-status');
    statusEl.className = 'stage-status ' + status;
    
    const icons = {
        pending: '⏳',
        active: '🔄',
        completed: '✅',
        failed: '❌'
    };
    
    statusEl.textContent = icons[status] || '⏳';
}

/**
 * 重置阶段状态
 */
function resetStageStatus() {
    ['script', 'storyboard', 'render', 'compose'].forEach(stage => {
        updateStageStatus(stage, 'pending');
    });
}

/**
 * 更新进度条
 */
function updateProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressPercent.textContent = `${Math.round(percent)}%`;
}

/**
 * 更新预览内容
 */
function updatePreview(assets, jobs) {
    elements.previewPanel.classList.remove('hidden');
    
    // 按类型分组资产
    const assetsByType = {};
    assets.forEach(asset => {
        if (!assetsByType[asset.type]) {
            assetsByType[asset.type] = [];
        }
        assetsByType[asset.type].push(asset);
    });
    
    let html = '';
    
    // 脚本预览
    if (assetsByType.script) {
        html += createPreviewCard('📝 脚本', assetsByType.script[0]?.metadata, 'script');
    }
    
    // 分镜预览
    if (assetsByType.storyboard) {
        html += createPreviewCard('🎨 分镜', assetsByType.storyboard[0]?.metadata, 'storyboard');
    }
    
    // 渲染预览
    if (assetsByType.render) {
        html += createPreviewCard('🎥 视频片段', `共 ${assetsByType.render.length} 个片段`, 'render');
    }
    
    // 合成预览
    if (assetsByType.video) {
        html += createPreviewCard('✨ 最终视频', assetsByType.video[0]?.uri, 'video');
    }
    
    elements.previewContent.innerHTML = html || '<p class="empty">暂无预览内容</p>';
}

/**
 * 创建预览卡片
 */
function createPreviewCard(title, content, type) {
    let contentHtml = '';
    
    if (typeof content === 'object' && content !== null) {
        contentHtml = `<pre>${JSON.stringify(content, null, 2)}</pre>`;
    } else if (content) {
        contentHtml = `<p>${content}</p>`;
    } else {
        contentHtml = '<p class="empty">处理中...</p>';
    }
    
    return `
        <div class="preview-card" data-type="${type}">
            <div class="preview-header">${title}</div>
            <div class="preview-body">${contentHtml}</div>
        </div>
    `;
}

/**
 * 显示结果面板
 */
function showResultPanel() {
    elements.resultPanel.classList.remove('hidden');
    elements.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('🎉 短剧生成完成！');
}

/**
 * 重置演示
 */
function resetDemo() {
    currentEpisodeId = null;
    
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    elements.title.value = '';
    elements.premise.value = '';
    elements.duration.value = '30';
    
    elements.progressPanel.classList.add('hidden');
    elements.resultPanel.classList.add('hidden');
    elements.previewPanel.classList.add('hidden');
    
    elements.startBtn.disabled = false;
    elements.startBtn.innerHTML = '<span class="btn-icon">🚀</span> 开始生成';
    
    updateProgress(0);
    resetStageStatus();
    
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 显示 Toast 通知
 */
function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, duration);
}

/**
 * 切换移动端菜单
 */
function toggleMobileMenu() {
    document.querySelector('.nav-links').classList.toggle('active');
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);

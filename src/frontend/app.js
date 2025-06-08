// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    // 初始化Mermaid
    mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        flowchart: {
            htmlLabels: true,
            curve: 'cardinal'
        },
        securityLevel: 'loose' // 允许点击事件
    });

    // 绑定按钮点击事件
    document.getElementById('analyzeBtn').addEventListener('click', analyzeRepository);
});

let currentRepoUrl = '';
const converter = new showdown.Converter();

// 分析仓库
async function analyzeRepository() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    
    if (!repoUrl) {
        showError('请输入GitHub仓库URL');
        return;
    }
    
    currentRepoUrl = repoUrl;
    
    if (!isValidGithubUrl(repoUrl)) {
        showError('请输入有效的GitHub仓库URL');
        return;
    }
    
    // 显示加载中
    showLoading();
    hideError();
    hideResults();
    
    try {
        // 发送请求到后端
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: repoUrl })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 处理响应数据
        displayResults(data);
    } catch (error) {
        console.error('Error:', error);
        showError(`分析失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 显示分析结果
function displayResults(data) {
    // 显示结果区域
    showResults();
    
    // 显示仓库基本信息
    displayRepoInfo(data.repoInfo);
    
    // 显示文件结构
    displayFileStructure(data.fileStructure);
    
    // 显示Mermaid图表
    displayMermaidChart(data.mermaidChart);
    
    // 显示D3.js依赖关系图
    displayDependencyGraph(data.dependencyData);
    
    // 显示代码质量分析
    displayCodeQualityAnalysis(data.codeQuality);
}

// 显示仓库基本信息
function displayRepoInfo(repoInfo) {
    document.getElementById('repoName').textContent = repoInfo.name;
    document.getElementById('repoDescription').textContent = repoInfo.description || '无描述';
    document.getElementById('repoLanguage').textContent = repoInfo.language || '未知';
    document.getElementById('repoStars').textContent = repoInfo.stars || 0;
    document.getElementById('repoForks').textContent = repoInfo.forks || 0;
    document.getElementById('repoCreated').textContent = formatDate(repoInfo.created_at);
    document.getElementById('repoUpdated').textContent = formatDate(repoInfo.updated_at);
}

// 显示文件结构
function displayFileStructure(fileStructure) {
    const fileStructureElement = document.getElementById('fileStructure');
    fileStructureElement.innerHTML = '';
    
    fileStructureElement.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-explain')) {
            const filePath = event.target.dataset.path;
            handleExplainClick(filePath);
        }
    });

    // 递归创建文件树
    function createTree(node, parentElement) {
        const ul = document.createElement('ul');
        parentElement.appendChild(ul);
        
        node.children.forEach(child => {
            const li = document.createElement('li');
            ul.appendChild(li);
            
            // 创建链接
            const a = document.createElement('a');
            a.href = child.url || '#';
            a.target = '_blank';
            
            // 添加图标
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            
            if (child.type === 'dir') {
                icon.textContent = '📁 ';
                a.className = 'dir';
                a.addEventListener('click', function(e) {
                    e.preventDefault();
                    this.parentElement.classList.toggle('expanded');
                });
            } else {
                icon.textContent = '📄 ';
                a.className = 'file';
            }
            
            a.prepend(icon);
            a.appendChild(document.createTextNode(child.name));
            
            li.appendChild(a);

            if (child.type === 'file') {
                const explainBtn = document.createElement('button');
                explainBtn.textContent = '解释代码';
                explainBtn.className = 'btn btn-outline-info btn-sm btn-explain';
                explainBtn.dataset.path = child.path;
                li.appendChild(explainBtn);
            }
            
            // 如果有子节点，递归创建子树
            if (child.children && child.children.length > 0) {
                createTree(child, li);
            }
        });
    }
    
    createTree(fileStructure, fileStructureElement);
}

// 显示Mermaid图表
function displayMermaidChart(mermaidCode) {
    const mermaidContainer = document.getElementById('mermaidChart');
    mermaidContainer.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
    
    // 重新渲染Mermaid
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
}

// 显示D3.js依赖关系图
function displayDependencyGraph(dependencyData) {
    // 使用D3Visualizations模块初始化依赖关系图
    window.D3Visualizations.initDependencyVisualization(dependencyData);
}

// 显示代码质量分析
function displayCodeQualityAnalysis(codeQuality) {
    // 使用D3Visualizations模块创建语言分布图表
    window.D3Visualizations.createLanguageDistributionChart(codeQuality.languageDistribution);
    
    // 使用D3Visualizations模块创建代码复杂度图表
    window.D3Visualizations.createCodeComplexityChart(codeQuality.complexity);
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// 验证GitHub URL
function isValidGithubUrl(url) {
    return /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?.*$/.test(url);
}

// 显示加载中
function showLoading() {
    document.getElementById('loading').classList.remove('d-none');
}

// 隐藏加载中
function hideLoading() {
    document.getElementById('loading').classList.add('d-none');
}

// 显示错误
function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
}

// 隐藏错误
function hideError() {
    document.getElementById('error').classList.add('d-none');
}

// 显示结果
function showResults() {
    document.getElementById('results').classList.remove('d-none');
}

// 隐藏结果
function hideResults() {
    document.getElementById('results').classList.add('d-none');
}

async function handleExplainClick(filePath) {
    if (!currentRepoUrl) {
        alert('无法获取仓库URL，请先分析一个仓库。');
        return;
    }

    const modalEl = document.getElementById('explanationModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const loadingEl = document.getElementById('explanationLoading');
    const contentEl = document.getElementById('explanationContent');
    const errorEl = document.getElementById('explanationError');

    // Show modal in loading state
    modal.show();
    loadingEl.classList.remove('d-none');
    contentEl.classList.add('d-none');
    errorEl.classList.add('d-none');
    document.getElementById('explanationModalLabel').textContent = `代码解释: ${filePath}`;

    try {
        const response = await fetch('/api/explain-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                repo_url: currentRepoUrl,
                file_path: filePath
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        contentEl.innerHTML = converter.makeHtml(data.explanation);
        
        contentEl.classList.remove('d-none');
    } catch (error) {
        errorEl.textContent = `生成解释失败: ${error.message}`;
        errorEl.classList.remove('d-none');
    } finally {
        loadingEl.classList.add('d-none');
    }
}

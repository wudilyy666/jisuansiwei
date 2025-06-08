from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import json
import re
import time
import requests
from urllib.parse import urlparse
from github import Github
from github import Auth
import logging
import random
import networkx as nx
import openai
from dotenv import load_dotenv
import httpx

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# 配置
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')  # 从环境变量获取GitHub Token
DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')  # 从环境变量获取通义千问API Key
MAX_FILES = 100  # 最大文件数限制
FILE_SIZE_LIMIT = 1024 * 1024  # 文件大小限制（1MB）

# 配置OpenAI客户端（通义千问API兼容OpenAI接口）
# 从环境变量中获取代理设置
http_proxy = os.environ.get('HTTP_PROXY')
https_proxy = os.environ.get('HTTPS_PROXY')
proxies = {"http://": http_proxy, "https://": https_proxy} if http_proxy and https_proxy else None

# 创建一个httpx客户端来配置代理
http_client = httpx.Client(proxies=proxies)

client = openai.OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    http_client=http_client
)

@app.route('/')
def index():
    """提供前端页面"""
    return app.send_static_file('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_repo():
    """分析GitHub仓库"""
    try:
        data = request.json
        repo_url = data.get('url')
        
        if not repo_url:
            return jsonify({'error': '缺少仓库URL'}), 400
        
        # 解析GitHub仓库URL
        parsed_url = urlparse(repo_url)
        path_parts = parsed_url.path.strip('/').split('/')
        
        if len(path_parts) < 2 or parsed_url.netloc != 'github.com':
            return jsonify({'error': '无效的GitHub仓库URL'}), 400
        
        owner, repo_name = path_parts[0], path_parts[1]
        
        # 获取仓库信息
        repo_info = get_repo_info(owner, repo_name)
        
        # 获取文件结构
        file_structure = get_repo_structure(owner, repo_name)
        
        # 生成依赖数据
        dependency_data = generate_dependency_data(file_structure)
        
        # 生成代码质量分析数据
        code_quality = generate_code_quality_data(file_structure)
        
        # 生成Mermaid图表
        mermaid_chart = generate_mermaid_chart_with_ai(file_structure)
        
        # 返回结果
        result = {
            'repoInfo': repo_info,
            'fileStructure': file_structure,
            'dependencyData': dependency_data,
            'codeQuality': code_quality,
            'mermaidChart': mermaid_chart
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"分析仓库时出错: {str(e)}", exc_info=True)
        return jsonify({'error': f'分析仓库时出错: {str(e)}'}), 500

@app.route('/api/explain-code', methods=['POST'])
def explain_code():
    """接收代码文件并返回AI生成的解释"""
    try:
        data = request.json
        repo_url = data.get('repo_url')
        file_path = data.get('file_path')

        if not repo_url or not file_path:
            return jsonify({'error': '缺少仓库URL或文件路径'}), 400

        # 解析GitHub仓库URL
        parsed_url = urlparse(repo_url)
        path_parts = parsed_url.path.strip('/').split('/')
        if len(path_parts) < 2 or parsed_url.netloc != 'github.com':
            return jsonify({'error': '无效的GitHub仓库URL'}), 400
        
        owner, repo_name = path_parts[0], path_parts[1]

        # 获取文件内容
        if GITHUB_TOKEN:
            auth = Auth.Token(GITHUB_TOKEN)
            g = Github(auth=auth)
        else:
            g = Github()
        
        repo = g.get_repo(f"{owner}/{repo_name}")
        
        try:
            content_file = repo.get_contents(file_path)
        except Exception as e:
            logger.error(f"无法从GitHub获取文件 '{file_path}': {e}")
            return jsonify({'error': f"文件 '{file_path}' 未找到或无法访问"}), 404

        if content_file.size > FILE_SIZE_LIMIT:
            return jsonify({'error': f"文件大小超过限制 ({FILE_SIZE_LIMIT / 1024 / 1024}MB)"}), 413

        code = content_file.decoded_content.decode('utf-8')

        # 准备提示
        prompt = f"""
你是一名资深软件工程师和代码审查专家。你的任务是清晰、简洁地解释给定的代码文件。
请分析以下代码文件，并提供详细的说明。

文件路径: `{file_path}`

代码内容:
```
{code}
```

请在你的解释中包含以下几点：
1.  **总体功能**: 这个文件的主要作用和功能是什么？
2.  **关键部分**: 识别并解释代码中的关键函数、类或逻辑块。
3.  **代码结构**: 描述代码的组织方式和结构。
4.  **潜在改进**: (可选) 如果你发现任何可以改进的地方（例如，性能、可读性、最佳实践），请提出来。

请使用Markdown格式进行回复，使其易于阅读。
"""
        
        # 调用通义千问API
        completion = client.chat.completions.create(
            model="qwen-turbo-latest", # 使用一个稳定且强大的模型
            messages=[
                {"role": "system", "content": "你是一名资深的软件工程师，擅长代码解释和审查。"},
                {"role": "user", "content": prompt}
            ],
            stream=False # 使用非流式输出以获得完整解释
        )

        explanation = completion.choices[0].message.content.strip()

        return jsonify({'explanation': explanation})

    except Exception as e:
        logger.error(f"解释代码时出错: {str(e)}", exc_info=True)
        return jsonify({'error': f'解释代码时出错: {str(e)}'}), 500

def get_repo_info(owner, repo_name):
    """获取GitHub仓库基本信息"""
    try:
        # 使用GitHub API获取仓库信息
        if GITHUB_TOKEN:
            auth = Auth.Token(GITHUB_TOKEN)
            g = Github(auth=auth)
        else:
            g = Github()
        
        repo = g.get_repo(f"{owner}/{repo_name}")
        
        return {
            'name': repo.name,
            'full_name': repo.full_name,
            'description': repo.description,
            'language': repo.language,
            'stars': repo.stargazers_count,
            'forks': repo.forks_count,
            'created_at': repo.created_at.isoformat(),
            'updated_at': repo.updated_at.isoformat(),
            'url': repo.html_url
        }
    except Exception as e:
        logger.error(f"获取仓库信息时出错: {str(e)}", exc_info=True)
        raise Exception(f"获取仓库信息失败: {str(e)}")

def get_repo_structure(owner, repo_name):
    """获取GitHub仓库文件结构"""
    try:
        # 使用GitHub API获取仓库文件结构
        if GITHUB_TOKEN:
            auth = Auth.Token(GITHUB_TOKEN)
            g = Github(auth=auth)
        else:
            g = Github()
        
        repo = g.get_repo(f"{owner}/{repo_name}")
        
        # 获取默认分支
        default_branch = repo.default_branch
        
        # 构建文件树
        root = {
            'name': repo_name,
            'type': 'dir',
            'path': '',
            'url': repo.html_url,
            'children': []
        }
        
        # 递归获取文件结构
        file_count = [0]  # 使用列表以便在递归函数中修改
        
        def get_contents(path, parent):
            try:
                contents = repo.get_contents(path, ref=default_branch)
                
                # 如果是单个文件
                if not isinstance(contents, list):
                    contents = [contents]
                
                for content in contents:
                    if file_count[0] >= MAX_FILES:
                        break
                    
                    file_info = {
                        'name': content.name,
                        'path': content.path,
                        'type': 'dir' if content.type == 'dir' else 'file',
                        'url': content.html_url,
                        'children': []
                    }
                    
                    parent['children'].append(file_info)
                    
                    if content.type == 'dir':
                        get_contents(content.path, file_info)
                    else:
                        file_count[0] += 1
            except Exception as e:
                logger.warning(f"获取路径 {path} 内容时出错: {str(e)}")
        
        get_contents('', root)
        return root
        
    except Exception as e:
        logger.error(f"获取仓库结构时出错: {str(e)}", exc_info=True)
        raise Exception(f"获取仓库结构失败: {str(e)}")

def generate_mermaid_chart_with_ai(file_structure):
    """使用通义千问API生成Mermaid图表"""
    try:
        # 准备文件结构描述
        structure_description = "仓库文件结构如下:\n"
        
        def process_node(node, level=0):
            nonlocal structure_description
            indent = "  " * level
            node_type = "目录" if node['type'] == 'dir' else "文件"
            structure_description += f"{indent}- {node['name']} ({node_type})\n"
            
            if 'children' in node and node['children']:
                for child in node['children'][:20]:  # 限制每级最多20个子节点
                    process_node(child, level + 1)
        
        process_node(file_structure)
        
        # 准备提示
        prompt = f"""
我需要你将以下GitHub仓库结构转换为Mermaid流程图格式。
请严格遵守以下规则，以避免语法错误：
1.  使用 `flowchart TD` (自上而下) 格式。
2.  节点ID必须是唯一的、不含特殊字符的字母数字字符串 (例如: `node1`, `node2`)。
3.  所有节点显示的文本标签都必须用双引号 `"` 包围 (例如: `node1["src/component.js"]`)。
4.  使用 `-->` 来表示父子关系 (例如: `node1 --> node2`)。
5.  为每个节点添加点击功能，URL必须用双引号 `"` 包围 (例如: `click node1 "https://github.com/..." _blank`)。
6.  为目录节点应用样式: `style nodeId fill:#f9f,stroke:#333,stroke-width:2px`。
7.  为文件节点应用样式: `style nodeId fill:#bbf,stroke:#333,stroke-width:2px`。
8.  为了图表清晰，请适当省略层级过深或文件过多的节点。

仓库结构:
{structure_description}

请只返回完整的、可直接渲染的Mermaid图表代码，不要包含任何解释或 "mermaid" 标记。
"""

        # 调用通义千问API
        try:
            completion = client.chat.completions.create(
                model="qwen-turbo-latest",
                messages=[
                    {"role": "system", "content": "你是一位专业的GitHub仓库可视化专家，精通Mermaid图表。"},
                    {"role": "user", "content": prompt}
                ],
                extra_body={"enable_thinking": False}
            )
            
            # 提取生成的Mermaid图表
            mermaid_chart = completion.choices[0].message.content.strip()
            
            # 如果图表被Markdown代码块包围，则去掉它们
            if mermaid_chart.startswith("```mermaid"):
                mermaid_chart = mermaid_chart.replace("```mermaid", "").replace("```", "").strip()
            elif mermaid_chart.startswith("```"):
                mermaid_chart = mermaid_chart.replace("```", "").strip()
                
            return mermaid_chart
            
        except Exception as api_error:
            logger.error(f"调用通义千问API时出错: {str(api_error)}", exc_info=True)
            # 如果API调用失败，回退到本地生成方法
            return generate_mermaid_chart(file_structure)
            
    except Exception as e:
        logger.error(f"使用AI生成Mermaid图表时出错: {str(e)}", exc_info=True)
        # 出错时回退到本地生成方法
        return generate_mermaid_chart(file_structure)

def generate_dependency_data(file_structure):
    """生成依赖关系数据，用于D3.js可视化"""
    try:
        # 创建节点和链接
        nodes = []
        links = []
        node_ids = set()
        
        # 递归处理文件结构
        def process_structure(node, parent_id=None):
            node_id = node['path'] if node['path'] else node['name']
            
            # 避免重复节点
            if node_id not in node_ids:
                node_type = node['type']
                
                # 确定节点大小和类型
                if node_type == 'dir':
                    size = 10 + min(len(node['children']), 10)
                    node_type = 'directory'
                else:
                    size = 5
                    node_type = 'file'
                
                # 添加节点
                nodes.append({
                    'id': node_id,
                    'name': node['name'],
                    'type': node_type,
                    'url': node['url'],
                    'size': size
                })
                
                node_ids.add(node_id)
                
                # 添加与父节点的链接
                if parent_id:
                    links.append({
                        'source': parent_id,
                        'target': node_id,
                        'value': 1
                    })
                
                # 处理子节点
                if 'children' in node and node['children']:
                    for child in node['children']:
                        process_structure(child, node_id)
        
        # 开始处理
        process_structure(file_structure)
        
        # 添加一些额外的依赖关系（基于文件类型和命名模式）
        add_inferred_dependencies(nodes, links)
        
        return {
            'nodes': nodes,
            'links': links
        }
    except Exception as e:
        logger.error(f"生成依赖数据时出错: {str(e)}", exc_info=True)
        return {'nodes': [], 'links': []}

def add_inferred_dependencies(nodes, links):
    """添加推断的依赖关系"""
    try:
        # 创建节点ID到节点的映射
        node_map = {node['id']: node for node in nodes}
        
        # 创建文件扩展名到节点ID的映射
        extension_map = {}
        for node in nodes:
            if node['type'] == 'file':
                parts = node['name'].split('.')
                if len(parts) > 1:
                    ext = parts[-1].lower()
                    if ext not in extension_map:
                        extension_map[ext] = []
                    extension_map[ext].append(node['id'])
        
        # 为JavaScript文件添加依赖关系
        if 'js' in extension_map:
            js_files = extension_map['js']
            
            # 查找package.json文件
            package_files = [node['id'] for node in nodes if node['name'] == 'package.json']
            
            # 将JS文件与package.json连接
            for js_file in js_files:
                for package_file in package_files:
                    links.append({
                        'source': js_file,
                        'target': package_file,
                        'value': 1
                    })
            
            # 连接一些JS文件之间的依赖
            if len(js_files) > 1:
                # 使用NetworkX创建一个有向图
                G = nx.DiGraph()
                for node_id in js_files:
                    G.add_node(node_id)
                
                # 基于命名模式添加边
                for i, source_id in enumerate(js_files):
                    source_name = node_map[source_id]['name'].lower()
                    
                    for target_id in js_files[i+1:]:
                        target_name = node_map[target_id]['name'].lower()
                        
                        # 如果文件名相似，添加连接
                        if source_name.split('.')[0] in target_name or target_name.split('.')[0] in source_name:
                            links.append({
                                'source': source_id,
                                'target': target_id,
                                'value': 2
                            })
        
        # 为Python文件添加依赖关系
        if 'py' in extension_map:
            py_files = extension_map['py']
            
            # 查找requirements.txt文件
            req_files = [node['id'] for node in nodes if node['name'] == 'requirements.txt']
            
            # 将Python文件与requirements.txt连接
            for py_file in py_files:
                for req_file in req_files:
                    links.append({
                        'source': py_file,
                        'target': req_file,
                        'value': 1
                    })
    
    except Exception as e:
        logger.error(f"添加推断依赖关系时出错: {str(e)}", exc_info=True)

def generate_code_quality_data(file_structure):
    """生成代码质量分析数据"""
    try:
        # 语言分布数据
        language_counts = {}
        
        # 代码复杂度数据（模拟）
        complexity_data = []
        
        # 递归处理文件结构
        def process_structure(node):
            if node['type'] == 'file':
                # 获取文件扩展名
                parts = node['name'].split('.')
                if len(parts) > 1:
                    ext = parts[-1].lower()
                    
                    # 映射扩展名到语言
                    lang = map_extension_to_language(ext)
                    if lang:
                        language_counts[lang] = language_counts.get(lang, 0) + 1
                    
                    # 为特定类型的文件生成复杂度数据
                    if ext in ['js', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php']:
                        # 模拟复杂度数据
                        complexity = random.randint(5, 30)
                        lines = random.randint(50, 500)
                        
                        complexity_data.append({
                            'file': node['name'],
                            'complexity': complexity,
                            'lines': lines
                        })
            
            # 处理子节点
            if 'children' in node and node['children']:
                for child in node['children']:
                    process_structure(child)
        
        # 开始处理
        process_structure(file_structure)
        
        # 将语言计数转换为百分比
        total_files = sum(language_counts.values())
        language_distribution = []
        
        if total_files > 0:
            for lang, count in language_counts.items():
                percentage = (count / total_files) * 100
                language_distribution.append({
                    'language': lang,
                    'percentage': percentage
                })
        
        # 按百分比排序
        language_distribution.sort(key=lambda x: x['percentage'], reverse=True)
        
        # 限制复杂度数据的数量
        complexity_data = sorted(complexity_data, key=lambda x: x['complexity'], reverse=True)[:10]
        
        return {
            'languageDistribution': language_distribution,
            'complexity': complexity_data
        }
    except Exception as e:
        logger.error(f"生成代码质量数据时出错: {str(e)}", exc_info=True)
        return {
            'languageDistribution': [],
            'complexity': []
        }

def map_extension_to_language(ext):
    """将文件扩展名映射到编程语言"""
    mapping = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'jsx': 'React',
        'tsx': 'React/TypeScript',
        'py': 'Python',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'cs': 'C#',
        'go': 'Go',
        'rb': 'Ruby',
        'php': 'PHP',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'less': 'Less',
        'json': 'JSON',
        'md': 'Markdown',
        'sql': 'SQL',
        'sh': 'Shell',
        'bat': 'Batch',
        'ps1': 'PowerShell',
        'swift': 'Swift',
        'kt': 'Kotlin',
        'rs': 'Rust',
        'dart': 'Dart',
        'vue': 'Vue',
        'svelte': 'Svelte'
    }
    return mapping.get(ext)

def generate_mermaid_chart(file_structure):
    """生成简单的Mermaid图表"""
    mermaid_lines = ["flowchart TD"]
    node_ids = {}
    node_counter = 1
    
    def safe_id(name):
        """生成安全的Mermaid ID"""
        return f"node{node_counter}"
    
    def process_node(node, parent_id=None, level=0):
        nonlocal node_counter
        
        # 限制层级深度
        if level > 3:
            return
        
        # 为当前节点生成ID
        node_id = safe_id(node['name'])
        node_counter += 1
        
        # 存储节点ID
        node_ids[node['path'] if node['path'] else node['name']] = node_id
        
        # 添加节点定义
        if node['type'] == 'dir':
            label = f"{node['name']} (目录)"
            style = "fill:#f9f,stroke:#333,stroke-width:1px"
        else:
            label = node['name']
            style = "fill:#bbf,stroke:#333,stroke-width:1px"
        
        # 添加URL链接
        url = node['url'] if 'url' in node else '#'
        mermaid_lines.append(f'{node_id}["{label}"]')
        mermaid_lines.append(f'click {node_id} href "{url}" _blank')
        mermaid_lines.append(f'style {node_id} {style}')
        
        # 添加与父节点的连接
        if parent_id:
            mermaid_lines.append(f"{parent_id} --> {node_id}")
        
        # 处理子节点
        if 'children' in node and node['children']:
            # 限制子节点数量
            for i, child in enumerate(node['children']):
                if i >= 10:  # 最多显示10个子节点
                    break
                process_node(child, node_id, level + 1)
    
    # 开始处理
    process_node(file_structure)
    
    return "\n".join(mermaid_lines)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8088) 
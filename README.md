# GitHub项目可视化分析工具

一个基于AI的GitHub仓库可视化分析工具，可以帮助用户快速理解项目结构、依赖关系和代码质量。

## 功能特点

- **仓库结构可视化**：直观展示项目的文件和目录结构
- **交互式依赖关系图**：使用D3.js实现的多种可视化方式
  - 力导向图：展示文件和目录之间的依赖关系
  - 层次结构图：以树形方式展示项目层级结构
  - 圆形打包图：以嵌套圆形方式展示项目结构和大小
- **代码质量分析**：展示代码复杂度和语言分布
- **项目架构图**：使用Mermaid生成项目架构图，支持点击跳转
- **AI辅助分析**：利用通义千问AI技术分析项目结构和依赖关系

## 技术栈

### 前端
- HTML5/CSS3/JavaScript
- Bootstrap 5
- D3.js - 用于创建交互式数据可视化
- Mermaid.js - 用于生成流程图和架构图

### 后端
- Python 3.8+
- Flask - Web框架
- PyGithub - GitHub API客户端
- NetworkX - 用于复杂网络分析
- 通义千问 - AI辅助分析（使用qwen3-235b-a22b模型）

## 安装与使用

### 环境要求
- Python 3.8+

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/github-visualization-tool.git
cd github-visualization-tool
```

2. 安装Python依赖
```bash
pip install -r requirements.txt
```

3. 设置环境变量
```bash
# Linux/macOS
export GITHUB_TOKEN=your_github_token
export DASHSCOPE_API_KEY=your_dashscope_api_key

# Windows
set GITHUB_TOKEN=your_github_token
set DASHSCOPE_API_KEY=your_dashscope_api_key
```

4. 或者创建.env文件（推荐）
在项目根目录创建一个名为.env的文件，内容如下：
```
GITHUB_TOKEN=your_github_token
DASHSCOPE_API_KEY=your_dashscope_api_key
```

5. 运行应用
```bash
python src/backend/app.py
```

6. 在浏览器中访问
现在，您可以直接访问您的后端服务地址：
```
http://localhost:8088
```

## 使用方法

1. 在首页输入GitHub仓库URL（例如：https://github.com/username/repo）
2. 点击"分析"按钮
3. 等待分析完成后，查看可视化结果
4. 可以通过切换不同的可视化方式（力导向图、层次结构图、圆形打包图）来查看项目依赖关系
5. 点击图表中的节点可以查看详细信息或跳转到GitHub对应文件

## API配置说明

### GitHub API
- 获取GitHub令牌：访问 https://github.com/settings/tokens 创建一个具有repo权限的个人访问令牌
- 将此令牌设置为环境变量GITHUB_TOKEN或添加到.env文件中

### 通义千问API
- 获取通义千问API密钥：访问 https://dashscope.aliyun.com/ 注册并创建API密钥
- 本项目使用的模型：qwen3-235b-a22b
- 将密钥设置为环境变量DASHSCOPE_API_KEY或添加到.env文件中

## 参考文献

1. M. Bostock, V. Ogievetsky, and J. Heer, "D3: Data-Driven Documents," IEEE Trans. Visualization & Comp. Graphics (Proc. InfoVis), 2011. [DOI: 10.1109/TVCG.2011.185](https://doi.org/10.1109/TVCG.2011.185)

2. Laindream, "go-callflow-vis: A tool for analyzing and visualizing complex software architecture hierarchies," GitHub Repository, 2024. [GitHub](https://github.com/laindream/go-callflow-vis)

3. ZbWeR, "Dependency-Analysis: A tool for analyzing project dependencies," GitHub Repository, 2023. [GitHub](https://github.com/ZbWeR/Dependency-Analysis)

4. Chennlang, "js-analyzer: A visual and interactive front-end project dependency analysis tool," GitHub Repository, 2024. [GitHub](https://github.com/chennlang/js-analyzer)

5. Heer, J., & Shneiderman, B. (2012). Interactive dynamics for visual analysis. Queue, 10(2), 30-55. [DOI: 10.1145/2133416.2146416](https://doi.org/10.1145/2133416.2146416)

6. 通义千问, "通义千问API文档," 阿里云, 2024. [文档链接](https://help.aliyun.com/zh/model-studio/developer-reference/compatible-mode-overview)

## 贡献

欢迎提交问题和拉取请求！

## 许可证

MIT 
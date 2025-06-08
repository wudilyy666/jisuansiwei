/**
 * GitHub项目可视化分析工具 - D3.js可视化模块
 * 该模块提供了三种不同的依赖关系可视化方式：
 * 1. 力导向图 - 展示文件和目录之间的关系
 * 2. 层次结构图 - 展示项目的层级结构
 * 3. 圆形打包图 - 以嵌套圆形方式展示项目结构和大小
 */

// 全局变量
let dependencyData = null;
let currentVisualization = null;

// 工具提示
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

/**
 * 初始化依赖关系可视化
 * @param {Object} data - 项目依赖数据
 */
function initDependencyVisualization(data) {
    dependencyData = data;
    
    // 默认显示力导向图
    createForceDirectedGraph(data);
    
    // 设置按钮事件监听
    document.getElementById('forceLayoutBtn').addEventListener('click', () => {
        clearVisualization();
        createForceDirectedGraph(dependencyData);
    });
    
    document.getElementById('hierarchicalBtn').addEventListener('click', () => {
        clearVisualization();
        createHierarchicalTree(dependencyData);
    });
    
    document.getElementById('circlePackingBtn').addEventListener('click', () => {
        clearVisualization();
        createCirclePacking(dependencyData);
    });
}

/**
 * 清除当前可视化
 */
function clearVisualization() {
    d3.select("#dependencyGraph").selectAll("*").remove();
}

/**
 * 创建力导向图
 * @param {Object} data - 项目依赖数据
 */
function createForceDirectedGraph(data) {
    // 获取容器尺寸
    const container = document.getElementById('dependencyGraph');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // 创建SVG
    const svg = d3.select("#dependencyGraph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        }));
    
    const g = svg.append("g");
    
    // 创建力导向模拟
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY());
    
    // 绘制连接线
    const link = g.append("g")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(data.links)
        .join("line")
        .attr("stroke-width", d => Math.sqrt(d.value || 1));
    
    // 绘制节点
    const node = g.append("g")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .selectAll("g")
        .data(data.nodes)
        .join("g")
        .attr("class", d => `node ${d.type || ''}`)
        .call(drag(simulation));
    
    // 添加节点圆形
    node.append("circle")
        .attr("r", d => d.size || 5)
        .attr("fill", d => getNodeColor(d))
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.name}</strong><br/>${d.type || 'file'}<br/>${d.info || ''}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.url) {
                window.open(d.url, '_blank');
            }
        });
    
    // 添加节点文本标签
    node.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .style("font-size", "12px")
        .style("fill", "#000")
        .text(d => d.name);
    
    // 更新模拟
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
    
    // 保存当前可视化
    currentVisualization = {
        type: 'force',
        simulation: simulation
    };
}

/**
 * 创建层次结构树
 * @param {Object} data - 项目依赖数据
 */
function createHierarchicalTree(data) {
    // 将节点和链接转换为层次结构数据
    const hierarchyData = convertToHierarchy(data);
    
    // 获取容器尺寸
    const container = document.getElementById('dependencyGraph');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // 创建SVG
    const svg = d3.select("#dependencyGraph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        }));
    
    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);
    
    // 创建树形布局
    const tree = d3.tree()
        .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
        .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
    
    // 计算节点位置
    const root = d3.hierarchy(hierarchyData);
    tree(root);
    
    // 创建径向连接线
    const link = g.append("g")
        .attr("fill", "none")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y));
    
    // 创建节点
    const node = g.append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 3)
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", d => `
            translate(${d.y * Math.sin(d.x)},${-d.y * Math.cos(d.x)})
        `);
    
    // 添加节点圆形
    node.append("circle")
        .attr("fill", d => d.children ? "#555" : "#999")
        .attr("r", 2.5)
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.data.name}</strong><br/>${d.data.type || 'file'}<br/>${d.data.info || ''}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.data.url) {
                window.open(d.data.url, '_blank');
            }
        });
    
    // 添加节点文本标签
    node.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d.x < Math.PI === !d.children ? 6 : -6)
        .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
        .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
        .text(d => d.data.name)
        .clone(true).lower()
        .attr("stroke", "white");
    
    // 保存当前可视化
    currentVisualization = {
        type: 'tree'
    };
}

/**
 * 创建圆形打包图
 * @param {Object} data - 项目依赖数据
 */
function createCirclePacking(data) {
    // 将节点和链接转换为层次结构数据
    const hierarchyData = convertToHierarchy(data);
    
    // 获取容器尺寸
    const container = document.getElementById('dependencyGraph');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // 创建SVG
    const svg = d3.select("#dependencyGraph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("font", "10px sans-serif")
        .call(d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        }));
    
    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);
    
    // 创建层次结构
    const root = d3.hierarchy(hierarchyData)
        .sum(d => d.size || 1)
        .sort((a, b) => b.value - a.value);
    
    // 创建圆形打包布局
    const pack = d3.pack()
        .size([width - 2, height - 2])
        .padding(3);
    
    pack(root);
    
    // 创建节点
    const node = g.append("g")
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", d => `translate(${d.x - width/2},${d.y - height/2})`);
    
    node.append("circle")
        .attr("fill", d => d.children ? "#fff" : getNodeColor(d.data))
        .attr("fill-opacity", d => d.children ? 0.1 : 0.8)
        .attr("stroke", d => d.children ? "#555" : getNodeColor(d.data))
        .attr("stroke-width", d => d.children ? 1 : 0)
        .attr("r", d => d.r)
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.data.name}</strong><br/>${d.data.type || 'file'}<br/>${d.data.info || ''}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.data.url) {
                window.open(d.data.url, '_blank');
            }
        });
    
    // 为叶子节点添加文本标签
    node.filter(d => !d.children && d.r > 10)
        .append("text")
        .attr("clip-path", d => `circle(${d.r}px)`)
        .selectAll("tspan")
        .data(d => d.data.name.split(/(?=[A-Z][a-z])|\s+/g))
        .join("tspan")
        .attr("x", 0)
        .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
        .attr("text-anchor", "middle")
        .text(d => d);
    
    // 保存当前可视化
    currentVisualization = {
        type: 'pack'
    };
}

/**
 * 将节点和链接数据转换为层次结构数据
 * @param {Object} data - 包含nodes和links的数据
 * @returns {Object} 层次结构数据
 */
function convertToHierarchy(data) {
    // 创建根节点
    const root = {
        name: "root",
        children: []
    };
    
    // 创建节点映射
    const nodeMap = {};
    data.nodes.forEach(node => {
        nodeMap[node.id] = {
            name: node.name,
            type: node.type,
            url: node.url,
            info: node.info,
            size: node.size || 1,
            children: []
        };
    });
    
    // 构建层次结构
    data.links.forEach(link => {
        const source = nodeMap[link.source.id || link.source];
        const target = nodeMap[link.target.id || link.target];
        
        if (source && target) {
            source.children.push(target);
        }
    });
    
    // 找出根节点（没有入边的节点）
    const hasIncomingEdge = new Set();
    data.links.forEach(link => {
        hasIncomingEdge.add(link.target.id || link.target);
    });
    
    data.nodes.forEach(node => {
        if (!hasIncomingEdge.has(node.id)) {
            root.children.push(nodeMap[node.id]);
        }
    });
    
    return root;
}

/**
 * 根据节点类型获取颜色
 * @param {Object} node - 节点数据
 * @returns {string} 颜色代码
 */
function getNodeColor(node) {
    switch (node.type) {
        case 'file':
            return '#4e79a7';
        case 'directory':
            return '#f28e2c';
        case 'package':
            return '#e15759';
        default:
            return '#69b3a2';
    }
}

/**
 * 创建拖拽行为
 * @param {Object} simulation - D3力导向模拟
 * @returns {Function} 拖拽行为函数
 */
function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    
    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

/**
 * 创建语言分布图表
 * @param {Object} data - 语言分布数据
 */
function createLanguageDistributionChart(data) {
    // 获取容器尺寸
    const container = document.getElementById('languageDistributionChart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2;
    
    // 创建SVG
    const svg = d3.select("#languageDistributionChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);
    
    // 颜色比例尺
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.language))
        .range(d3.schemeCategory10);
    
    // 创建饼图
    const pie = d3.pie()
        .value(d => d.percentage)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius * 0.8);
    
    const outerArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);
    
    // 绘制饼图
    const arcs = svg.selectAll("arc")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "arc");
    
    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.language))
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.data.language}</strong><br/>${d.data.percentage.toFixed(1)}%`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // 添加连接线和标签
    arcs.each(function(d) {
        const pos = outerArc.centroid(d);
        const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        pos[0] = radius * 0.95 * (midAngle < Math.PI ? 1 : -1);
        
        const percent = d.data.percentage.toFixed(1);
        if (percent < 5) return; // 跳过百分比太小的标签
        
        const g = d3.select(this);
        
        // 连接线
        g.append("polyline")
            .attr("points", [
                arc.centroid(d),
                outerArc.centroid(d),
                pos
            ])
            .attr("fill", "none")
            .attr("stroke", "gray")
            .attr("stroke-width", 1);
        
        // 标签
        g.append("text")
            .attr("transform", `translate(${pos[0]},${pos[1]})`)
            .attr("dy", ".35em")
            .attr("text-anchor", midAngle < Math.PI ? "start" : "end")
            .text(`${d.data.language} (${percent}%)`)
            .style("font-size", "10px");
    });
    
    // 添加标题
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("y", -height/2 + 20)
        .attr("class", "chart-title")
        .text("语言分布")
        .style("font-size", "14px")
        .style("font-weight", "bold");
}

/**
 * 创建代码复杂度图表
 * @param {Object} data - 代码复杂度数据
 */
function createCodeComplexityChart(data) {
    // 获取容器尺寸
    const container = document.getElementById('codeComplexityChart');
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = {top: 40, right: 30, bottom: 60, left: 60};
    
    // 创建SVG
    const svg = d3.select("#codeComplexityChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 创建X轴比例尺
    const x = d3.scaleBand()
        .domain(data.map(d => d.file))
        .range([0, width - margin.left - margin.right])
        .padding(0.2);
    
    // 创建Y轴比例尺
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.complexity) * 1.1])
        .range([height - margin.top - margin.bottom, 0]);
    
    // 绘制X轴
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "10px");
    
    // 绘制Y轴
    svg.append("g")
        .call(d3.axisLeft(y));
    
    // 添加X轴标签
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top - margin.bottom + 50)
        .text("文件")
        .style("font-size", "12px");
    
    // 添加Y轴标签
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .text("复杂度")
        .style("font-size", "12px");
    
    // 添加标题
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", -20)
        .attr("class", "chart-title")
        .text("代码复杂度分析")
        .style("font-size", "14px")
        .style("font-weight", "bold");
    
    // 绘制柱状图
    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.file))
        .attr("y", d => y(d.complexity))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.top - margin.bottom - y(d.complexity))
        .attr("fill", d => {
            // 根据复杂度设置颜色
            if (d.complexity < 10) return "#4e79a7";
            if (d.complexity < 20) return "#f28e2c";
            return "#e15759";
        })
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.file}</strong><br/>复杂度: ${d.complexity}<br/>行数: ${d.lines}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

// 导出函数
window.D3Visualizations = {
    initDependencyVisualization,
    createLanguageDistributionChart,
    createCodeComplexityChart
};

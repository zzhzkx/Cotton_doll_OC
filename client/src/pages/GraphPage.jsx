import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { relationships } from '../api';
import './GraphPage.css';

const RELATION_TYPES = ['朋友', '恋人', '家人', '对手', '师徒', '室友', '邻居'];
const REL_COLORS = {
  '朋友': '#A8E6CF', '恋人': '#FFB5C2', '家人': '#C5A3FF',
  '对手': '#FFB347', '师徒': '#87CEEB', '室友': '#DDA0DD', '邻居': '#F0E68C',
};

// 根据节点数量自动计算合适的间距
function calcLinkDistance(nodeCount) {
  if (nodeCount <= 3) return 220;
  if (nodeCount <= 6) return 180;
  if (nodeCount <= 12) return 140;
  if (nodeCount <= 20) return 100;
  return Math.max(60, Math.round(200 / Math.sqrt(nodeCount)));
}

// 圆角矩形（兼容旧浏览器）
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function GraphPage() {
  const navigate = useNavigate();
  const graphRef = useRef(null);
  const avatarCache = useRef({});
  const canvasRef = useRef(null);

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [allDolls, setAllDolls] = useState([]);
  const [loading, setLoading] = useState(true);

  // 缩放等级（1 = 100%）
  const zoomLevelRef = useRef(1);
  const [zoomLevel, setZoomLevel] = useState(1);

  // 高亮状态
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);

  // 整簇拖动
  const clusterDragRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // 创建关系模式
  const [createMode, setCreateMode] = useState(false);
  const [relNodeA, setRelNodeA] = useState(null);
  const [relNodeB, setRelNodeB] = useState(null);
  const [relStep, setRelStep] = useState(0);

  // 避免 stale closure 的 ref（在 state/callback 定义之后）
  const createModeRef = useRef(false);
  const graphDataRef = useRef(graphData);
  const findClusterRef = useRef(null);
  useEffect(() => { createModeRef.current = createMode; }, [createMode]);
  useEffect(() => { graphDataRef.current = graphData; }, [graphData]);

  // 弹窗
  const [showManualModal, setShowManualModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRel, setSelectedRel] = useState(null);
  const [editType, setEditType] = useState('');
  const [newRel, setNewRel] = useState({ from_doll: '', to_doll: '', type: '朋友' });

  // 设置面板
  const [showSettings, setShowSettings] = useState(false);
  // 外观设置
  const [showArrows, setShowArrows] = useState(false);
  const [textOpacity, setTextOpacity] = useState(100);
  const [nodeSize, setNodeSize] = useState(24);
  const [linkThickness, setLinkThickness] = useState(2);
  // 力度设置（百分比 0-100）
  const [centerStrength, setCenterStrength] = useState(50);   // 映射到 0.15-0.6
  const [repulsion, setRepulsion] = useState(50);             // 映射到 -50 到 -300
  const [linkStrength, setLinkStrength] = useState(50);       // 映射到 0.1 到 0.6
  const [linkDistance, setLinkDistanceState] = useState(() => calcLinkDistance(graphData.nodes.length || 1));

  // --- 加载数据 ---
  const loadGraph = useCallback(async () => {
    try {
      const data = await relationships.graph();
      setAllDolls(data.dolls);
      // 预加载头像
      data.dolls.forEach(d => {
        if (d.avatar && !avatarCache.current[d.id]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { /* canvas 自动在下一帧重绘 */ };
          img.src = d.avatar;
          avatarCache.current[d.id] = img;
        }
      });
      const nodes = data.dolls.map(d => ({ id: d.id, name: d.name, avatar: d.avatar, bio: d.bio }));
      const links = data.relationships.map(r => ({
        id: r.id, source: r.from_doll, target: r.to_doll,
        type: r.type, from_name: r.from_name, to_name: r.to_name,
      }));
      setGraphData({ nodes, links });
    } catch (err) {
      console.error('加载图谱失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // 圆形边界半径：向心力越大 → 圆越大 → 节点越分散
  const getRadialRadius = useCallback(() => {
    const n = graphData.nodes.length;
    const baseRadius = Math.max(200, n * 40);
    return baseRadius * (0.5 + (centerStrength / 100) * 1.5);
  }, [graphData.nodes.length, centerStrength]);

  // 自定义向心力：只约束边界，不干涉圆内分布
  const createCenterForce = useCallback((radius) => {
    let nodes;
    const force = (alpha) => {
      if (!nodes) return;
      const strength = 0.05 + (centerStrength / 100) * 0.15;
      for (const node of nodes) {
        const dx = node.x || 0;
        const dy = node.y || 0;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > radius) {
          // 超出圆 → 拉回圆内
          const pull = strength * alpha * (dist - radius) / dist;
          node.vx = (node.vx || 0) - dx * pull;
          node.vy = (node.vy || 0) - dy * pull;
        }
        // 圆内不施加力，让排斥力自然分散节点
      }
    };
    force.initialize = (_nodes) => { nodes = _nodes; };
    return force;
  }, [centerStrength]);

  // 排斥力和吸引力
  const getForceValues = useCallback(() => {
    // 排斥力：最小 -20（保持基本散开），最大 -200（推向边界）
    const charge = -(20 + repulsion * 1.8);
    const link = 0.1 + (linkStrength / 100) * 0.9;
    return { charge, link };
  }, [repulsion, linkStrength]);

  // --- 引擎初始化 ---
  const handleEngineInit = useCallback((fg) => {
    const f = getForceValues();
    const r = getRadialRadius();
    fg.d3Force('center', null);
    fg.d3Force('radial', null);
    fg.d3Force('cottonCenter', createCenterForce(r));
    fg.d3Force('charge').strength(f.charge).distanceMax(400);
    fg.d3Force('link').strength(f.link).distance(linkDistance);
    fg.d3Force('collide', forceCollide(16).strength(0.8));
    fg.d3VelocityDecay(0.45);
    fg.d3AlphaDecay(0.02);
    fg.d3AlphaMin(0.005);
    setTimeout(() => { fg.zoomToFit(800, 80); }, 800);
  }, [getForceValues, getRadialRadius, linkDistance, createCenterForce]);

  // 重热
  const gentleReheat = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    try {
      const sim = fg.d3Force && fg.d3Force();
      if (sim && typeof sim.alpha === 'function') {
        sim.alpha(0.5).restart();
        return;
      }
    } catch (e) { /* not available */ }
    try {
      if (fg.d3ReheatSimulation) fg.d3ReheatSimulation();
    } catch (e) { /* ignore */ }
  }, []);

  // --- 力度参数实时更新 ---
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !fg.d3Force) return;
    try {
      const f = getForceValues();
      const r = getRadialRadius();
      fg.d3Force('cottonCenter', createCenterForce(r));
      fg.d3Force('charge').strength(f.charge);
      fg.d3Force('link').strength(f.link).distance(linkDistance);
      gentleReheat();
    } catch (e) { /* ignore */ }
  }, [repulsion, linkStrength, linkDistance, centerStrength, getForceValues, getRadialRadius, createCenterForce, gentleReheat]);

  // --- 缩放回调：跟踪缩放等级 ---
  const handleZoom = useCallback(({ k }) => {
    zoomLevelRef.current = k;
    setZoomLevel(prev => {
      const diff = Math.abs(prev - k);
      return diff > 0.05 ? k : prev;
    });
  }, []);

  // --- Canvas 长按事件 ---
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    const canvas = document.querySelector('.graph-container canvas');
    if (!canvas) return;

    const findNodeAt = (clientX, clientY) => {
      try {
        const nodes = graphData.nodes;
        let closest = null;
        let minDist = Infinity;
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          // 用 graph2ScreenCoords 把节点坐标转到屏幕
          let sx, sy;
          if (typeof fg.graph2ScreenCoords === 'function') {
            const sc = fg.graph2ScreenCoords(node.x, node.y);
            sx = sc.x; sy = sc.y;
          } else {
            // 备用：手动用 zoom + canvas offset 计算
            const rect = canvas.getBoundingClientRect();
            const z = zoomLevelRef.current || 1;
            sx = node.x * z + rect.width / 2;
            sy = node.y * z + rect.height / 2;
          }
          const dx = clientX - sx;
          const dy = clientY - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // 点击区域 = 节点实际渲染大小（随缩放变化）
          const z = zoomLevelRef.current || 1;
          const hitRadius = z < 0.4 ? 10 : Math.max(16, nodeSize);
          if (dist < hitRadius && dist < minDist) {
            closest = node;
            minDist = dist;
          }
        }
        return closest;
      } catch { return null; }
    };

    const onPointerDown = (e) => {
      if (createModeRef.current) return;
      const node = findNodeAt(e.clientX, e.clientY);
      if (!node) return;

      longPressTimerRef.current = setTimeout(() => {
        if (!findClusterRef.current) return;
        const cluster = findClusterRef.current(node.id);
        clusterDragRef.current = { clusterIds: cluster };
        isDraggingRef.current = true;

        const newHighlightNodes = new Set(cluster);
        const newHighlightLinks = new Set();
        const links = graphDataRef.current.links;
        links.forEach(link => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          if (cluster.has(srcId) || cluster.has(tgtId)) {
            newHighlightLinks.add(link.id);
          }
        });
        setHighlightNodes(newHighlightNodes);
        setHighlightLinks(newHighlightLinks);
        setHoverNode(node.id);
      }, 400);
    };

    const onPointerUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, [graphData]);


  // --- 自动适配视图 ---
  const handleFitView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(600, 120);
    }
  }, []);

  // --- 高亮逻辑：计算连接集合 ---
  const updateHighlight = useCallback((node) => {
    if (!node) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      setHoverNode(null);
      return;
    }

    const newHighlightNodes = new Set([node.id]);
    const newHighlightLinks = new Set();

    graphData.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === node.id || tgtId === node.id) {
        newHighlightLinks.add(link.id);
        newHighlightNodes.add(srcId);
        newHighlightNodes.add(tgtId);
      }
    });

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
    setHoverNode(node.id);
  }, [graphData.links]);

  // --- BFS 查找整簇（所有间接相连的节点） ---
  const findCluster = useCallback((startId) => {
    const adj = {};
    graphData.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (!adj[srcId]) adj[srcId] = [];
      if (!adj[tgtId]) adj[tgtId] = [];
      adj[srcId].push(tgtId);
      adj[tgtId].push(srcId);
    });
    const visited = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
      const curr = queue.shift();
      (adj[curr] || []).forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    return visited;
  }, [graphData.links]);
  useEffect(() => { findClusterRef.current = findCluster; }, [findCluster]);

  // --- 长按检测：pointer down 开始计时 ---
  const handleNodePointerDown = useCallback((node, event) => {
    if (createMode) return;
    // 清除之前的计时器
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    isDraggingRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      // 长按触发：找到整簇，高亮，准备拖动
      const cluster = findCluster(node.id);
      clusterDragRef.current = { clusterIds: cluster };
      isDraggingRef.current = true;

      // 高亮整簇
      const newHighlightNodes = new Set(cluster);
      const newHighlightLinks = new Set();
      graphData.links.forEach(link => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (cluster.has(srcId) || cluster.has(tgtId)) {
          newHighlightLinks.add(link.id);
        }
      });
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
      setHoverNode(node.id);
    }, 400); // 400ms 长按
  }, [createMode, findCluster, graphData.links]);

  // --- 计算 BFS 深度（距离头鸟的跳数） ---
  const computeDepths = useCallback((leaderId, clusterIds) => {
    const adj = {};
    graphData.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (clusterIds.has(srcId) && clusterIds.has(tgtId)) {
        if (!adj[srcId]) adj[srcId] = [];
        if (!adj[tgtId]) adj[tgtId] = [];
        adj[srcId].push(tgtId);
        adj[tgtId].push(srcId);
      }
    });
    const depths = { [leaderId]: 0 };
    const queue = [leaderId];
    while (queue.length > 0) {
      const curr = queue.shift();
      (adj[curr] || []).forEach(nb => {
        if (depths[nb] == null) {
          depths[nb] = depths[curr] + 1;
          queue.push(nb);
        }
      });
    }
    return depths;
  }, [graphData.links]);

  // --- 拖动中：A 字形雁群编队追随 ---
  const handleNodeDrag = useCallback((node, translate) => {
    // 第一帧：激活簇，计算编队信息
    if (!clusterDragRef.current) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!findClusterRef.current) return;
      const cluster = findClusterRef.current(node.id);
      const depths = computeDepths(node.id, cluster);

      clusterDragRef.current = {
        clusterIds: cluster,
        leaderId: node.id,
        depths,
        lastLeaderX: node.x,
        lastLeaderY: node.y,
        // 同层节点计数器（用于左右交替排列）
        depthCounter: {},
      };
      isDraggingRef.current = true;

      const newHighlightNodes = new Set(cluster);
      const newHighlightLinks = new Set();
      graphDataRef.current.links.forEach(link => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (cluster.has(srcId) || cluster.has(tgtId)) {
          newHighlightLinks.add(link.id);
        }
      });
      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
      setHoverNode(node.id);
      return;
    }

    // 后续帧：A 字形编队追随
    const { clusterIds, depths, leaderId } = clusterDragRef.current;
    if (node.id !== leaderId) return;

    // 计算移动方向
    const prevX = clusterDragRef.current.lastLeaderX;
    const prevY = clusterDragRef.current.lastLeaderY;
    let moveDx = node.x - prevX;
    let moveDy = node.y - prevY;
    const moveLen = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

    // 如果还没移动足够距离，用默认方向（向下）
    if (moveLen < 0.5) {
      moveDx = 0; moveDy = 1;
    } else {
      moveDx /= moveLen; moveDy /= moveLen;
    }

    // 移动方向的垂直向量（用于左右展开）
    const perpX = -moveDy;
    const perpY = moveDx;

    const TRAIL_DIST = 70;    // 每层深度的后方距离
    const SPREAD = 35;        // 左右展开宽度
    const SPRING = 0.12;      // 弹性系数（越小追随越慢，编队越松散）

    // 每个深度层的节点序号（用于左右交替）
    const depthCounter = {};

    graphData.nodes.forEach(n => {
      if (n.id === leaderId || !clusterIds.has(n.id)) return;
      const depth = depths[n.id];
      if (depth == null) return;

      // 后方距离 = 深度 × 步长
      const backDist = depth * TRAIL_DIST;
      // 左右交替排列：同层第0个靠左，第1个靠右，第2个更左...
      const idx = depthCounter[depth] || 0;
      depthCounter[depth] = idx + 1;
      const side = (idx % 2 === 0 ? -1 : 1) * Math.ceil(idx / 2);

      // 目标位置 = 头鸟位置 + 后退 + 左右偏移
      const targetX = node.x - moveDx * backDist + perpX * SPREAD * side;
      const targetY = node.y - moveDy * backDist + perpY * SPREAD * side;

      // 弹性趋近
      n.x += (targetX - n.x) * SPRING;
      n.y += (targetY - n.y) * SPRING;
    });

    clusterDragRef.current.lastLeaderX = node.x;
    clusterDragRef.current.lastLeaderY = node.y;
  }, [graphData.nodes]);

  // --- 拖动结束：清理 ---
  const handleNodeDragEnd = useCallback(() => {
    clusterDragRef.current = null;
    isDraggingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // --- 节点点击 ---
  const handleNodeClick = useCallback((node, event) => {
    event && event.stopPropagation();

    if (createMode) {
      // 创建关系模式
      if (relStep === 0) {
        setRelNodeA(node);
        setRelStep(1);
        updateHighlight(node);
      } else if (relStep === 1 && node.id !== relNodeA?.id) {
        setRelNodeB(node);
        setRelStep(2);
        // 高亮 A 和 B
        const newHighlightNodes = new Set([relNodeA.id, node.id]);
        setHighlightNodes(newHighlightNodes);
        const newHighlightLinks = new Set();
        graphData.links.forEach(link => {
          const srcId = typeof link.source === 'object' ? link.source.id : link.source;
          const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
          if ((srcId === relNodeA.id && tgtId === node.id) || (srcId === node.id && tgtId === relNodeA.id)) {
            newHighlightLinks.add(link.id);
          }
        });
        setHighlightLinks(newHighlightLinks);
      }
    } else {
      // 浏览模式：点击高亮
      if (hoverNode === node.id) {
        // 再次点击同一节点取消高亮
        updateHighlight(null);
      } else {
        updateHighlight(node);
      }
    }
  }, [createMode, relStep, relNodeA, hoverNode, graphData.links, updateHighlight]);

  // 点击空白取消
  const handleBackgroundClick = useCallback(() => {
    if (createMode && relStep > 0) {
      setRelStep(0);
      setRelNodeA(null);
      setRelNodeB(null);
      updateHighlight(null);
    } else {
      updateHighlight(null);
    }
  }, [createMode, relStep, updateHighlight]);

  // 点击连线
  const handleLinkClick = useCallback((link) => {
    setSelectedRel(link);
    setEditType(link.type);
    setShowEditModal(true);
  }, []);

  // --- 切换创建模式 ---
  const toggleCreateMode = useCallback(() => {
    setCreateMode(prev => {
      if (prev) {
        // 退出
        setRelStep(0);
        setRelNodeA(null);
        setRelNodeB(null);
        updateHighlight(null);
      }
      return !prev;
    });
  }, [updateHighlight]);

  // --- 确认创建关系 ---
  const confirmRel = useCallback(async (type) => {
    if (!relNodeA || !relNodeB) return;
    try {
      await relationships.create({ from_doll: relNodeA.id, to_doll: relNodeB.id, type });
      setCreateMode(false);
      setRelStep(0);
      setRelNodeA(null);
      setRelNodeB(null);
      updateHighlight(null);
      loadGraph();
    } catch (err) {
      alert(err.message);
    }
  }, [relNodeA, relNodeB, loadGraph, updateHighlight]);

  // 手动创建关系
  const handleManualCreate = async () => {
    if (!newRel.from_doll || !newRel.to_doll) return;
    try {
      await relationships.create(newRel);
      setShowManualModal(false);
      setNewRel({ from_doll: '', to_doll: '', type: '朋友' });
      loadGraph();
    } catch (err) { alert(err.message); }
  };

  // 编辑/删除关系
  const handleEditRel = async () => {
    if (!selectedRel || !editType) return;
    try {
      await relationships.update(selectedRel.id, { type: editType });
      setShowEditModal(false);
      setSelectedRel(null);
      loadGraph();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteRel = async () => {
    if (!selectedRel || !window.confirm('确定删除这条关系？')) return;
    try {
      await relationships.delete(selectedRel.id);
      setShowEditModal(false);
      setSelectedRel(null);
      loadGraph();
    } catch (err) { alert(err.message); }
  };

  // --- 绘制节点（缩放自适应） ---
  const nodeCanvasObject = useCallback((node, ctx) => {
    const z = zoomLevelRef.current;
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const opacity = isHighlighted ? 1 : 0.12;
    const isHover = hoverNode === node.id;
    const isRelA = relNodeA && node.id === relNodeA.id;
    const isRelB = relNodeB && node.id === relNodeB.id;

    ctx.save();
    ctx.globalAlpha = opacity;

    // ---- 缩小到一定程度：变成固定屏幕大小的圆点 ----
    if (z < 0.4) {
      const SCREEN_DOT = 5;  // 屏幕上固定 5px
      const dotSize = SCREEN_DOT / z;  // 除以 zoom，补偿 canvas 缩放
      const isSpecial = isHover || isRelA || isRelB;

      ctx.beginPath();
      ctx.arc(node.x, node.y, isSpecial ? dotSize * 1.4 : dotSize, 0, 2 * Math.PI);
      if (isRelA) ctx.fillStyle = '#FFB5C2';
      else if (isRelB) ctx.fillStyle = '#C5A3FF';
      else ctx.fillStyle = isHighlighted ? '#FFB5C2' : 'rgba(255,181,194,0.3)';
      ctx.fill();

      // 发光
      if (isSpecial) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, dotSize * 2, 0, 2 * Math.PI);
        ctx.fillStyle = isRelA ? 'rgba(255,181,194,0.25)' : 'rgba(197,163,255,0.25)';
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // ---- 正常视图：头像 + 名字（保证最小屏幕尺寸） ----
    const minScreenSize = 16;
    const size = Math.max(minScreenSize / z, nodeSize);
    const img = avatarCache.current[node.id];

    // 绘制圆形
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.closePath();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.clip();
      ctx.drawImage(img, node.x - size, node.y - size, size * 2, size * 2);
      ctx.restore();
    } else {
      try {
        const g = ctx.createLinearGradient(node.x - size, node.y - size, node.x + size, node.y + size);
        g.addColorStop(0, '#FFD6DE');
        g.addColorStop(1, '#DFD0FF');
        ctx.fillStyle = g;
      } catch { ctx.fillStyle = '#FFD6DE'; }
      ctx.fill();
      ctx.fillStyle = '#3D2B1F';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name.charAt(0), node.x, node.y);
    }

    // 边框
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    if (isHover || isRelA || isRelB) {
      ctx.strokeStyle = isRelA ? '#FFB5C2' : isRelB ? '#C5A3FF' : '#FFB5C2';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = `${isRelA ? '#FFB5C2' : isRelB ? '#C5A3FF' : '#FFB5C2'}55`;
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      ctx.strokeStyle = isHighlighted ? 'rgba(255,181,194,0.7)' : 'rgba(255,181,194,0.2)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 创建模式 A/B 标记
    if (createMode) {
      if (isRelA || isRelB) {
        const color = isRelA ? '#FFB5C2' : '#C5A3FF';
        const label = isRelA ? 'A' : 'B';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x + size - 3, node.y - size + 3, 12, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, node.x + size - 3, node.y - size + 3);
      }
    }

    // 名字标签（中等缩放以上才显示）
    if (isHighlighted && z >= 0.6 && textOpacity > 0) {
      const fontSize = 13;
      const labelAlpha = textOpacity / 100;
      ctx.globalAlpha = opacity * labelAlpha;
      ctx.font = `600 ${fontSize}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(node.name).width;
      const pad = 6;
      const bgX = node.x - tw / 2 - pad;
      const bgY = node.y + size + 6;

      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      drawRoundRect(ctx, bgX, bgY, tw + pad * 2, fontSize + pad * 2, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#3D2B1F';
      ctx.fillText(node.name, node.x, bgY + pad);
    }

    ctx.restore();
  }, [highlightNodes, hoverNode, createMode, relNodeA, relNodeB, nodeSize, textOpacity]);

  // --- 绘制连线（缩放自适应） ---
  const linkCanvasObject = useCallback((link, ctx) => {
    const s = link.source;
    const t = link.target;
    if (typeof s !== 'object' || typeof t !== 'object' || s.x == null || t.x == null) return;

    const z = zoomLevelRef.current;
    const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link.id);
    const opacity = isHighlighted ? 1 : 0.06;
    const midX = (s.x + t.x) / 2;
    const midY = (s.y + t.y) / 2;
    const color = REL_COLORS[link.type] || '#FFB5C2';

    ctx.save();
    ctx.globalAlpha = opacity;

    // 连线粗细：用户设置 × 缩放系数
    // 连线粗细：保证屏幕最小 0.5px
    const screenLineWidth = linkThickness * (isHighlighted ? 1 : 0.5);
    const lineWidth = Math.max(0.5 / z, screenLineWidth);

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.3, lineWidth);
    ctx.stroke();

    // 箭头
    if (showArrows && isHighlighted && z >= 0.4) {
      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const arrowLen = 10;
      const endX = t.x - Math.cos(angle) * 32;
      const endY = t.y - Math.sin(angle) * 32;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowLen * Math.cos(angle - 0.4), endY - arrowLen * Math.sin(angle - 0.4));
      ctx.lineTo(endX - arrowLen * Math.cos(angle + 0.4), endY - arrowLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 关系标签
    if (isHighlighted && z >= 0.5) {
      const text = link.type;
      ctx.font = `500 ${z >= 0.8 ? 12 : 10}px "Noto Sans SC", sans-serif`;
      const tw = ctx.measureText(text).width;
      const pad = 10;
      const bgW = tw + pad * 2;
      const bgH = 24;

      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      drawRoundRect(ctx, midX - bgW / 2, midY - bgH / 2, bgW, bgH, 10);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#3D2B1F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, midX, midY);
    }

    ctx.restore();
  }, [highlightLinks, linkThickness, showArrows]);

  if (loading) return <div className="container" style={{ paddingTop: '40px' }}>加载中...</div>;

  return (
    <div className="graph-page" onClick={handleBackgroundClick}>
      {/* 工具栏 */}
      <div className="graph-toolbar" onClick={e => e.stopPropagation()}>
        <h2>关系图谱</h2>
        <div className="toolbar-center">
          <button className="toolbar-icon-btn" onClick={handleFitView} title="自动适配视图">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
          <button
            className={`toolbar-icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="图谱设置"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
        <div className="toolbar-actions">
          <button className={`btn btn-sm ${createMode ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleCreateMode}>
            {createMode ? '✕ 退出创建' : '🔗 新建关系'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowManualModal(true)}>
            手动选择
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="settings-panel fade-in-up" onClick={e => e.stopPropagation()}>
          {/* 力度 */}
          <div className="settings-section">
            <h3 className="settings-section-title">力度</h3>
            <div className="settings-row">
              <span className="settings-label">向心力</span>
              <input type="range" min="0" max="100" step="1" value={centerStrength}
                onInput={e => setCenterStrength(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{centerStrength}%</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">排斥力</span>
              <input type="range" min="0" max="100" step="1" value={repulsion}
                onInput={e => setRepulsion(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{repulsion}%</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">吸引力</span>
              <input type="range" min="0" max="100" step="1" value={linkStrength}
                onInput={e => setLinkStrength(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{linkStrength}%</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">连线长度</span>
              <input type="range" min="30" max="400" step="5" value={linkDistance}
                onInput={e => setLinkDistanceState(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{linkDistance}px</span>
            </div>
          </div>
          {/* 外观 */}
          <div className="settings-section">
            <h3 className="settings-section-title">外观</h3>
            <div className="settings-row">
              <span className="settings-label">箭头</span>
              <button className={`toggle-btn ${showArrows ? 'on' : 'off'}`}
                onClick={() => setShowArrows(!showArrows)}>
                {showArrows ? '开' : '关'}
              </button>
            </div>
            <div className="settings-row">
              <span className="settings-label">文本透明度</span>
              <input type="range" min="0" max="100" step="5" value={textOpacity}
                onInput={e => setTextOpacity(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{textOpacity}%</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">节点大小</span>
              <input type="range" min="16" max="50" step="1" value={nodeSize}
                onInput={e => setNodeSize(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{nodeSize}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">连线粗细</span>
              <input type="range" min="0.5" max="6" step="0.25" value={linkThickness}
                onInput={e => setLinkThickness(Number(e.target.value))} className="settings-slider" />
              <span className="settings-value">{linkThickness}</span>
            </div>
          </div>
        </div>
      )}

      {/* 模式状态栏 */}
      {createMode && (
        <div className="mode-banner fade-in-up" onClick={e => e.stopPropagation()}>
          {relStep === 0 && (
            <span>👆 <strong>第一步：</strong>点击选择第一个娃娃（A）</span>
          )}
          {relStep === 1 && (
            <span>
              👆 <strong>第二步：</strong>点击选择第二个娃娃（B）&nbsp;&nbsp;
              <small>已选：{relNodeA?.name}</small>
            </span>
          )}
          {relStep === 2 && (
            <span className="rel-confirm-row">
              <span className="rel-confirm-info">
                ✅ <strong>{relNodeA?.name}</strong> ↔ <strong>{relNodeB?.name}</strong>
                <small>&nbsp;选择关系类型：</small>
              </span>
              <span className="rel-confirm-btns">
                {RELATION_TYPES.map(t => (
                  <button key={t} className="mode-type-btn" onClick={() => confirmRel(t)}>
                    {t}
                  </button>
                ))}
              </span>
            </span>
          )}
        </div>
      )}

      {/* 高亮提示 */}
      {hoverNode && !createMode && (
        <div className="mode-banner highlight-banner fade-in-up" onClick={e => e.stopPropagation()}>
          <span>🔍 <strong>{allDolls.find(d => d.id === hoverNode)?.name}</strong> 的关系网络</span>
          <button className="banner-close" onClick={() => updateHighlight(null)}>✕</button>
        </div>
      )}

      {/* 图谱 */}
      <div className="graph-container">
        {graphData.nodes.length === 0 ? (
          <div className="graph-empty">
            <div className="empty-icon">🕸️</div>
            <h2>还没有娃娃</h2>
            <p>先添加几个娃娃，再来建立关系吧！</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObject={linkCanvasObject}
            onNodeClick={handleNodeClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onLinkClick={handleLinkClick}
            onBackgroundClick={handleBackgroundClick}
            onZoom={handleZoom}
            onEngineInit={handleEngineInit}
            nodeLabel="name"
            backgroundColor="#FFF8F0"
            linkDirectionalArrowLength={showArrows ? 6 : 0}
            linkDirectionalArrowRelPos={1}
            warmupTicks={0}
            cooldownTime={30000}
            d3AlphaMin={0.005}
            autoPauseRedraw={false}
          />
        )}
      </div>

      {/* 手动选择弹窗 */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <h3>新建关系</h3>
            <div className="form-group">
              <label>娃娃A</label>
              <select value={newRel.from_doll} onChange={e => setNewRel({ ...newRel, from_doll: Number(e.target.value) })}>
                <option value="">请选择</option>
                {allDolls.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>娃娃B</label>
              <select value={newRel.to_doll} onChange={e => setNewRel({ ...newRel, to_doll: Number(e.target.value) })}>
                <option value="">请选择</option>
                {allDolls.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>关系类型</label>
              <div className="rel-type-selector">
                {RELATION_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`mood-btn ${newRel.type === t ? 'active' : ''}`}
                    onClick={() => setNewRel({ ...newRel, type: t })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowManualModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleManualCreate}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑关系弹窗 */}
      {showEditModal && selectedRel && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <h3>编辑关系</h3>
            <p className="rel-info">{selectedRel.from_name} ↔ {selectedRel.to_name}</p>
            <div className="form-group">
              <label>关系类型</label>
              <div className="rel-type-selector">
                {RELATION_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`mood-btn ${editType === t ? 'active' : ''}`}
                    onClick={() => setEditType(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-danger" onClick={handleDeleteRel}>删除关系</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditRel}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';

function loadSettings() {
  try {
    const saved = localStorage.getItem('graphSettings');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

const DEFAULTS = {
  centerStrength: 50,   // 边界半径（向心力）
  repulsion: 50,         // 节点间距（排斥力）
  nodeSize: 24,
  linkThickness: 2,
  showArrows: false,
  textOpacity: 100,
};

// --- 工具函数 ---

function findConnectedComponents(nodes, links) {
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  links.forEach(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (adj[s]) adj[s].push(t);
    if (adj[t]) adj[t].push(s);
  });
  const visited = new Set();
  const components = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const comp = [];
    const queue = [node.id];
    while (queue.length > 0) {
      const c = queue.shift();
      if (visited.has(c)) continue;
      visited.add(c);
      comp.push(c);
      (adj[c] || []).forEach(nb => { if (!visited.has(nb)) queue.push(nb); });
    }
    components.push(comp);
  }
  return components;
}

function computeDegrees(links) {
  const deg = {};
  links.forEach(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    deg[s] = (deg[s] || 0) + 1;
    deg[t] = (deg[t] || 0) + 1;
  });
  return deg;
}

// 六角网格均匀分布点（蜂窝状 + 微小随机偏移，均匀但不死板）
function hexGridPoints(n) {
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const idealSpacing = 80;
  const rows = Math.ceil(Math.sqrt(n * Math.sqrt(3) / Math.PI) * 1.3);
  const spacing = idealSpacing;
  const rowHeight = spacing * Math.sqrt(3) / 2;
  const jitter = spacing * 0.02; // ±2% 的间距作为随机偏移

  const points = [];
  for (let row = -rows; row <= rows; row++) {
    const xOffset = (row % 2 !== 0) ? spacing / 2 : 0;
    for (let col = -rows; col <= rows; col++) {
      const x = col * spacing + xOffset + (Math.random() - 0.5) * jitter * 2;
      const y = row * rowHeight + (Math.random() - 0.5) * jitter * 2;
      points.push({ x, y });
    }
  }

  points.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y));
  return points.slice(0, n);
}

// 计算边界半径（自动跟随节点数）
function calcBoundaryRadius(nodeCount, centerStrength) {
  if (nodeCount <= 1) return 100;
  const baseSpacing = 80;
  const rows = Math.ceil(Math.sqrt(nodeCount * Math.sqrt(3) / Math.PI) * 1.3);
  const naturalRadius = rows * baseSpacing * Math.sqrt(3) / 2 + baseSpacing;
  // centerStrength 0~100 缩放自然半径
  const scale = 0.4 + (centerStrength / 100) * 1.2;
  return naturalRadius * scale;
}

// 为每个节点计算目标位置
function computeTargets(nodes, links) {
  const n = nodes.length;
  if (n === 0) return {};

  const sortedNodes = [...nodes].sort((a, b) => a.id - b.id);
  const points = hexGridPoints(n);

  const targets = {};
  sortedNodes.forEach((node, i) => {
    if (i < points.length) {
      targets[node.id] = points[i];
    } else {
      const angle = (2 * Math.PI * i) / n;
      const r = 80 * Math.sqrt(n) * 0.5;
      targets[node.id] = { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    }
  });

  return targets;
}

// 拖拽落位：节点拖到新位置后，找到最近的 hex 槽位，被挤走的节点退让到最近的空位
function displaceTargets(targets, draggedNodeId, dropX, dropY, allHexPoints) {
  const newTargets = { ...targets };

  // 1. 找离落点最近的 hex 槽位
  let nearestIdx = 0;
  let nearestDist = Infinity;
  allHexPoints.forEach((pt, i) => {
    const d = (pt.x - dropX) ** 2 + (pt.y - dropY) ** 2;
    if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
  });

  // 2. 看这个槽位被谁占着
  const targetPt = allHexPoints[nearestIdx];
  let displacedNodeId = null;
  for (const [nId, pt] of Object.entries(newTargets)) {
    if (Number(nId) === draggedNodeId) continue;
    if (Math.abs(pt.x - targetPt.x) < 0.1 && Math.abs(pt.y - targetPt.y) < 0.1) {
      displacedNodeId = Number(nId);
      break;
    }
  }

  // 3. 被拖拽节点 → 占据最近槽位
  newTargets[draggedNodeId] = { x: targetPt.x, y: targetPt.y };

  // 4. 被挤走的节点 → 找最近的空槽位（排除所有已被占用的）
  if (displacedNodeId != null) {
    // 收集所有当前占用位置（已被拖拽节点更新后）
    const occupied = new Set();
    for (const [nId, pt] of Object.entries(newTargets)) {
      if (Number(nId) === displacedNodeId) continue; // 排除自己
      occupied.add(`${Math.round(pt.x)},${Math.round(pt.y)}`);
    }

    // 在 hex 点中找最近的空位
    let bestIdx = 0;
    let bestDist = Infinity;
    allHexPoints.forEach((pt, i) => {
      const key = `${Math.round(pt.x)},${Math.round(pt.y)}`;
      if (occupied.has(key)) return;
      const d = (pt.x - targetPt.x) ** 2 + (pt.y - targetPt.y) ** 2;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    newTargets[displacedNodeId] = { x: allHexPoints[bestIdx].x, y: allHexPoints[bestIdx].y };
  }

  return newTargets;
}

export default function useForceEngine(graphData) {
  const saved = loadSettings();
  const [centerStrength, setCenterStrength] = useState(saved?.centerStrength ?? DEFAULTS.centerStrength);
  const [repulsion, setRepulsion] = useState(saved?.repulsion ?? DEFAULTS.repulsion);
  const [nodeSize, setNodeSize] = useState(saved?.nodeSize ?? DEFAULTS.nodeSize);
  const [linkThickness, setLinkThickness] = useState(saved?.linkThickness ?? DEFAULTS.linkThickness);
  const [showArrows, setShowArrows] = useState(saved?.showArrows ?? DEFAULTS.showArrows);
  const [textOpacity, setTextOpacity] = useState(saved?.textOpacity ?? DEFAULTS.textOpacity);

  const graphRef = useRef(null);
  const targetsRef = useRef({});
  const hexPointsRef = useRef([]);
  const prevNodesLenRef = useRef(0);
  const dragStateRef = useRef(null); // { nodeId, startX, startY, connectedIds }

  useEffect(() => {
    const s = { centerStrength, repulsion, nodeSize, linkThickness, showArrows, textOpacity };
    localStorage.setItem('graphSettings', JSON.stringify(s));
  }, [centerStrength, repulsion, nodeSize, linkThickness, showArrows, textOpacity]);

  // 重新计算目标位置（节点数变化时）
  useEffect(() => {
    if (graphData.nodes.length !== prevNodesLenRef.current && graphData.nodes.length > 0) {
      const hexPoints = hexGridPoints(graphData.nodes.length);
      hexPointsRef.current = hexPoints;
      targetsRef.current = computeTargets(graphData.nodes, graphData.links);
      prevNodesLenRef.current = graphData.nodes.length;
    }
  }, [graphData]);

  // 拖拽开始：记录起始位置和相连节点
  const handleDragStart = useCallback((nodeId) => {
    const targets = targetsRef.current;
    const startTarget = targets[nodeId];
    if (!startTarget) return;

    // 找所有与 nodeId 有双向链接的节点
    const connSet = new Set();
    graphData.links.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === nodeId) connSet.add(t);
      if (t === nodeId) connSet.add(s);
    });

    // 记录相连节点的初始目标位置
    const connOrigins = {};
    connSet.forEach(id => {
      if (targets[id]) connOrigins[id] = { ...targets[id] };
    });

    dragStateRef.current = {
      nodeId,
      startX: startTarget.x,
      startY: startTarget.y,
      connectedIds: connSet,
      connOrigins,
    };
  }, [graphData.links]);

  // 拖拽中：更新被拖拽节点的目标，相连节点弹性跟随
  const handleDragMove = useCallback((nodeId, currentX, currentY) => {
    const ds = dragStateRef.current;
    if (!ds || ds.nodeId !== nodeId) return;

    const targets = { ...targetsRef.current };
    // 被拖拽节点的目标 = 当前鼠标位置
    targets[nodeId] = { x: currentX, y: currentY };

    // 相连节点跟随：距离超过阈值后开始弹性移动
    const dx = currentX - ds.startX;
    const dy = currentY - ds.startY;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    const followThreshold = 60; // 拖拽超过 60px 开始跟随

    if (dragDist > followThreshold) {
      const followFactor = Math.min(0.4, (dragDist - followThreshold) / 500); // 最大跟随 40%
      ds.connectedIds.forEach(connId => {
        const orig = ds.connOrigins[connId];
        if (!orig) return;
        targets[connId] = {
          x: orig.x + dx * followFactor,
          y: orig.y + dy * followFactor,
        };
      });
    }

    targetsRef.current = targets;
  }, []);

  // 拖拽结束：落位 + 退让
  const handleDragEnd = useCallback((draggedNodeId, dropX, dropY) => {
    const hexPoints = hexPointsRef.current;
    if (hexPoints.length === 0) return;

    // 被拖拽节点落位到最近 hex 槽
    targetsRef.current = displaceTargets(
      targetsRef.current, draggedNodeId, dropX, dropY, hexPoints
    );

    // 相连节点：如果被拉离了原位，也落位到最近的空槽
    const ds = dragStateRef.current;
    if (ds) {
      let targets = { ...targetsRef.current };
      ds.connectedIds.forEach(connId => {
        const orig = ds.connOrigins[connId];
        const curr = targets[connId];
        if (!orig || !curr) return;
        const movedDist = Math.sqrt((curr.x - orig.x) ** 2 + (curr.y - orig.y) ** 2);
        if (movedDist > 30) {
          // 被拉离了原位，找最近的空 hex 槽
          targets = displaceTargets(targets, connId, curr.x, curr.y, hexPoints);
        }
      });
      targetsRef.current = targets;
    }

    dragStateRef.current = null;

    // 重热
    const fg = graphRef.current;
    if (fg) {
      try {
        const f = fg.d3Force('layout');
        if (f && f.simulation) f.simulation().alpha(0.8).restart();
      } catch { /* ignore */ }
      try { if (fg.d3ReheatSimulation) fg.d3ReheatSimulation(); } catch { /* ignore */ }
    }
  }, []);

  // 主力函数：弹簧 + 碰撞 + 边界
  const createForce = useCallback(() => {
    let nodes;
    const force = () => {
      if (!nodes || nodes.length < 2) return;

      const targets = targetsRef.current;
      const boundaryRadius = calcBoundaryRadius(nodes.length, centerStrength);
      const springK = 0.25;
      const collisionR = 28; // 物理碰撞半径

      // 弹簧力：拉向目标位置
      for (const node of nodes) {
        const target = targets[node.id];
        if (!target) continue;
        node.vx = (node.vx || 0) + (target.x - node.x) * springK;
        node.vy = (node.vy || 0) + (target.y - node.y) * springK;
      }

      // 碰撞力：两两不重叠
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          if (dist < collisionR * 2) {
            const overlap = collisionR * 2 - dist;
            const push = overlap * 0.3;
            const nx = dx / dist;
            const ny = dy / dist;
            a.vx -= nx * push;
            a.vy -= ny * push;
            b.vx += nx * push;
            b.vy += ny * push;
          }
        }
      }

      // 边界约束
      for (const node of nodes) {
        const dist = Math.sqrt(node.x * node.x + node.y * node.y) || 1;
        if (dist > boundaryRadius) {
          const pull = 0.2 * (dist - boundaryRadius) / dist;
          node.vx -= node.x * pull;
          node.vy -= node.y * pull;
        }
      }
    };
    force.initialize = (_nodes) => { nodes = _nodes; };
    return force;
  }, [centerStrength]);

  const reheat = useCallback((fg) => {
    if (!fg) fg = graphRef.current;
    if (!fg) return;
    try {
      const f = fg.d3Force('layout');
      if (f && f.simulation) { f.simulation().alpha(0.6).restart(); return; }
    } catch { /* ignore */ }
    try { if (fg.d3ReheatSimulation) { fg.d3ReheatSimulation(); return; } } catch { /* ignore */ }
  }, []);

  const handleEngineInit = useCallback((fg) => {
    fg.d3Force('center', null);
    fg.d3Force('radial', null);
    fg.d3Force('link', null);
    fg.d3Force('charge', null);
    fg.d3Force('layout', createForce());
    fg.d3VelocityDecay(0.6);
    fg.d3AlphaDecay(0.02);
    fg.d3AlphaMin(0.01);
    graphRef.current = fg;
    setTimeout(() => { fg.zoomToFit(800, 80); }, 800);
  }, [createForce]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !fg.d3Force) return;
    const timer = setTimeout(() => {
      try {
        fg.d3Force('layout', createForce());
        reheat(fg);
      } catch { /* ignore */ }
    }, 50);
    return () => clearTimeout(timer);
  }, [centerStrength, repulsion, createForce, reheat]);

  const settings = { centerStrength, repulsion, nodeSize, linkThickness, showArrows, textOpacity };
  const setSettings = { setCenterStrength, setRepulsion, setNodeSize, setLinkThickness, setShowArrows, setTextOpacity };

  return { graphRef, settings, setSettings, handleEngineInit, reheat, handleDragStart, handleDragMove, handleDragEnd };
}

import { useState, useCallback, useRef, useEffect } from 'react';

// BFS 查找整条关系链
function findCluster(startId, links) {
  const adj = {};
  links.forEach(link => {
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
    (adj[curr] || []).forEach(nb => {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
    });
  }
  return visited;
}

// BFS 深度
function computeDepths(leaderId, clusterIds, links) {
  const adj = {};
  links.forEach(link => {
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
      if (depths[nb] == null) { depths[nb] = depths[curr] + 1; queue.push(nb); }
    });
  }
  return depths;
}

const TRAIL_DIST = 70;
const SPREAD = 35;
const SPRING = 0.12;

export default function useClusterDrag(graphData, reheat) {
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);

  const clusterRef = useRef(null); // { clusterIds, leaderId, depths, lastX, lastY }
  const longPressTimerRef = useRef(null);

  // 高亮节点及其邻居
  const updateHighlight = useCallback((node) => {
    if (!node) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      setHoverNode(null);
      return;
    }
    const newNodes = new Set([node.id]);
    const newLinks = new Set();
    graphData.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === node.id || tgtId === node.id) {
        newLinks.add(link.id);
        newNodes.add(srcId);
        newNodes.add(tgtId);
      }
    });
    setHighlightNodes(newNodes);
    setHighlightLinks(newLinks);
    setHoverNode(node.id);
  }, [graphData.links]);

  // 高亮整簇
  const highlightCluster = useCallback((clusterIds) => {
    const newNodes = new Set(clusterIds);
    const newLinks = new Set();
    graphData.links.forEach(link => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (clusterIds.has(srcId) || clusterIds.has(tgtId)) {
        newLinks.add(link.id);
      }
    });
    setHighlightNodes(newNodes);
    setHighlightLinks(newLinks);
  }, [graphData.links]);

  // 拖动开始/拖动中
  const handleNodeDrag = useCallback((node) => {
    // 第一帧：激活簇
    if (!clusterRef.current) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const cluster = findCluster(node.id, graphData.links);
      const depths = computeDepths(node.id, cluster, graphData.links);
      clusterRef.current = {
        clusterIds: cluster,
        leaderId: node.id,
        depths,
        lastX: node.x,
        lastY: node.y,
      };
      highlightCluster(cluster);
      setHoverNode(node.id);
      return;
    }

    // 后续帧：A 字形编队追随
    const { clusterIds, depths, leaderId } = clusterRef.current;
    if (node.id !== leaderId) return;

    // 移动方向
    const prevX = clusterRef.current.lastX;
    const prevY = clusterRef.current.lastY;
    let moveDx = node.x - prevX;
    let moveDy = node.y - prevY;
    const moveLen = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
    if (moveLen < 0.5) { moveDx = 0; moveDy = 1; }
    else { moveDx /= moveLen; moveDy /= moveLen; }

    const perpX = -moveDy;
    const perpY = moveDx;
    const depthCounter = {};

    graphData.nodes.forEach(n => {
      if (n.id === leaderId || !clusterIds.has(n.id)) return;
      const depth = depths[n.id];
      if (depth == null) return;
      const backDist = depth * TRAIL_DIST;
      const idx = depthCounter[depth] || 0;
      depthCounter[depth] = idx + 1;
      const side = (idx % 2 === 0 ? -1 : 1) * Math.ceil(idx / 2);
      const targetX = node.x - moveDx * backDist + perpX * SPREAD * side;
      const targetY = node.y - moveDy * backDist + perpY * SPREAD * side;
      n.x += (targetX - n.x) * SPRING;
      n.y += (targetY - n.y) * SPRING;
    });

    clusterRef.current.lastX = node.x;
    clusterRef.current.lastY = node.y;
  }, [graphData, highlightCluster]);

  // 拖动结束
  const handleNodeDragEnd = useCallback(() => {
    clusterRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // 重新分布：让力系统从当前位置重新排列节点
    if (reheat) reheat();
  }, [reheat]);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  return {
    highlightNodes,
    highlightLinks,
    hoverNode,
    setHoverNode,
    updateHighlight,
    handleNodeDrag,
    handleNodeDragEnd,
    setHighlightNodes,
    setHighlightLinks,
  };
}

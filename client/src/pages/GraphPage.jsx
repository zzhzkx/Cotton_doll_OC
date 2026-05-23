import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { relationships } from '../api';
import useForceEngine from '../hooks/useForceEngine';
import useClusterDrag from '../hooks/useClusterDrag';
import useGraphRenderer from '../hooks/useGraphRenderer';
import GraphToolbar from '../components/GraphToolbar';
import SettingsPanel from '../components/SettingsPanel';
import ModeBanner from '../components/ModeBanner';
import CreateRelModal from '../components/CreateRelModal';
import EditRelModal from '../components/EditRelModal';
import './GraphPage.css';

export default function GraphPage() {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [allDolls, setAllDolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const avatarCache = useRef({});

  // 创建模式状态
  const [createMode, setCreateMode] = useState(false);
  const [relStep, setRelStep] = useState(0);
  const [relNodeA, setRelNodeA] = useState(null);
  const [relNodeB, setRelNodeB] = useState(null);

  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRel, setSelectedRel] = useState(null);
  const [editType, setEditType] = useState('');

  // --- 力系统 hook ---
  const { graphRef, settings, setSettings, handleEngineInit, reheat, handleDragStart, handleDragMove, handleDragEnd } = useForceEngine(graphData);

  // --- 拖拽 hook ---
  const {
    highlightNodes, highlightLinks, hoverNode, setHoverNode,
    updateHighlight, handleNodeDrag, handleNodeDragEnd: clusterDragEnd,
    setHighlightNodes, setHighlightLinks,
  } = useClusterDrag(graphData, reheat);

  // --- 渲染 hook ---
  const { nodeCanvasObject, linkCanvasObject, handleZoom } = useGraphRenderer(
    settings, highlightNodes, highlightLinks, hoverNode, avatarCache
  );

  // --- 数据加载 ---
  const loadGraph = useCallback(async () => {
    try {
      const data = await relationships.graph();
      setAllDolls(data.dolls);
      data.dolls.forEach(d => {
        if (d.avatar && !avatarCache.current[d.id]) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
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

  // 拖拽结束：触发落位 + 退让
  const onNodeDragEnd = useCallback((node) => {
    clusterDragEnd(); // 清理拖拽状态
    handleDragEnd(node.id, node.x, node.y); // 落位到最近 hex 槽 + 退让
  }, [clusterDragEnd, handleDragEnd]);

  // --- 交互：节点点击 ---
  const handleNodeClick = useCallback((node, event) => {
    event?.stopPropagation();
    if (createMode) {
      if (relStep === 0) {
        // 选 A：只标记 A，不暗淡其他节点
        setRelNodeA(node);
        setRelStep(1);
        setHighlightNodes(new Set()); // 清空 → 渲染器不暗淡任何节点
        setHighlightLinks(new Set());
        setHoverNode(node.id);
      } else if (relStep === 1 && node.id !== relNodeA?.id) {
        // 选 B：标记 A 和 B
        setRelNodeB(node);
        setRelStep(2);
        setHighlightNodes(new Set()); // 保持不暗淡
        setHoverNode(node.id);
      }
    } else {
      if (hoverNode === node.id) {
        updateHighlight(null);
      } else {
        updateHighlight(node);
      }
    }
  }, [createMode, relStep, relNodeA, hoverNode, updateHighlight, setHighlightNodes]);

  // --- 交互：点击空白 ---
  const handleBackgroundClick = useCallback(() => {
    if (createMode && relStep > 0) {
      setRelStep(0); setRelNodeA(null); setRelNodeB(null);
      updateHighlight(null);
    } else {
      updateHighlight(null);
    }
  }, [createMode, relStep, updateHighlight]);

  // --- 交互：点击连线 ---
  const handleLinkClick = useCallback((link) => {
    setSelectedRel(link);
    setEditType(link.type);
    setShowEditModal(true);
  }, []);

  // --- 自动适配视图 ---
  const handleFitView = useCallback(() => {
    graphRef.current?.zoomToFit(600, 120);
  }, [graphRef]);

  // --- 创建模式切换 ---
  const toggleCreateMode = useCallback(() => {
    setCreateMode(prev => {
      if (prev) { setRelStep(0); setRelNodeA(null); setRelNodeB(null); updateHighlight(null); }
      return !prev;
    });
  }, [updateHighlight]);

  // --- 确认创建关系（图谱上点击） ---
  const confirmRel = useCallback(async (type) => {
    if (!relNodeA || !relNodeB) return;
    try {
      await relationships.create({ from_doll: relNodeA.id, to_doll: relNodeB.id, type });
      setCreateMode(false); setRelStep(0); setRelNodeA(null); setRelNodeB(null);
      updateHighlight(null);
      loadGraph();
    } catch (err) { alert(err.message); }
  }, [relNodeA, relNodeB, loadGraph, updateHighlight]);

  // --- 手动创建关系 ---
  const handleManualCreate = useCallback(async (data) => {
    try {
      await relationships.create(data);
      setShowCreateModal(false);
      loadGraph();
    } catch (err) { alert(err.message); }
  }, [loadGraph]);

  // --- 编辑/删除关系 ---
  const handleEditRel = useCallback(async () => {
    if (!selectedRel || !editType) return;
    try {
      await relationships.update(selectedRel.id, { type: editType });
      setShowEditModal(false); setSelectedRel(null);
      loadGraph();
    } catch (err) { alert(err.message); }
  }, [selectedRel, editType, loadGraph]);

  const handleDeleteRel = useCallback(async () => {
    if (!selectedRel || !window.confirm('确定删除这条关系？')) return;
    try {
      await relationships.delete(selectedRel.id);
      setShowEditModal(false); setSelectedRel(null);
      loadGraph();
    } catch (err) { alert(err.message); }
  }, [selectedRel, loadGraph]);

  // 高亮节点名
  const highlightNodeName = hoverNode && !createMode ? allDolls.find(d => d.id === hoverNode)?.name : null;

  if (loading) return <div className="container" style={{ paddingTop: '40px' }}>加载中...</div>;

  return (
    <div className="graph-page">
      <GraphToolbar
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        onFitView={handleFitView}
        createMode={createMode}
        toggleCreateMode={toggleCreateMode}
        onManualCreate={() => setShowCreateModal(true)}
      />

      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} />}

      <ModeBanner
        createMode={createMode}
        relStep={relStep}
        relNodeA={relNodeA}
        relNodeB={relNodeB}
        onConfirmRel={confirmRel}
        highlightNodeName={highlightNodeName}
        onClearHighlight={() => updateHighlight(null)}
        allDolls={allDolls}
      />

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
            onNodeDragEnd={onNodeDragEnd}
            onLinkClick={handleLinkClick}
            onBackgroundClick={handleBackgroundClick}
            onZoom={handleZoom}
            onEngineInit={handleEngineInit}
            nodeLabel="name"
            backgroundColor="#FFF8F0"
            linkDirectionalArrowLength={settings.showArrows ? 6 : 0}
            linkDirectionalArrowRelPos={1}
            warmupTicks={0}
            cooldownTime={30000}
            d3AlphaMin={0.01}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.45}
            autoPauseRedraw={false}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateRelModal
          allDolls={allDolls}
          onSubmit={handleManualCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showEditModal && (
        <EditRelModal
          selectedRel={selectedRel}
          editType={editType}
          setEditType={setEditType}
          onSave={handleEditRel}
          onDelete={handleDeleteRel}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

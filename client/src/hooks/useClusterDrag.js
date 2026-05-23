import { useState, useCallback } from 'react';

export default function useClusterDrag(graphData, reheat) {
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);

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
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (s === node.id || t === node.id) {
        newLinks.add(link.id);
        newNodes.add(s);
        newNodes.add(t);
      }
    });
    setHighlightNodes(newNodes);
    setHighlightLinks(newLinks);
    setHoverNode(node.id);
  }, [graphData.links]);

  return {
    highlightNodes, highlightLinks, hoverNode, setHoverNode,
    updateHighlight, setHighlightNodes, setHighlightLinks,
  };
}

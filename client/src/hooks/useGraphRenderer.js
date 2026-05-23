import { useCallback, useRef } from 'react';

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

const REL_COLORS = {
  '朋友': '#A8E6CF', '恋人': '#FFB5C2', '家人': '#C5A3FF',
  '对手': '#FFB347', '师徒': '#87CEEB', '室友': '#DDA0DD', '邻居': '#F0E68C',
};

export default function useGraphRenderer(settings, highlightNodes, highlightLinks, hoverNode, avatarCache) {
  const zoomRef = useRef(1);

  // 缩放回调
  const handleZoom = useCallback(({ k }) => {
    zoomRef.current = k;
  }, []);

  // 节点绘制
  const nodeCanvasObject = useCallback((node, ctx) => {
    const z = zoomRef.current;
    const { nodeSize, textOpacity, showArrows } = settings;
    const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const opacity = isHighlighted ? 1 : 0.12;
    const isHover = hoverNode === node.id;

    ctx.save();
    ctx.globalAlpha = opacity;

    // 缩放自适应大小
    if (z < 0.4) {
      // 星空模式：固定 5px 圆点
      const dotSize = 5 / z;
      ctx.beginPath();
      ctx.arc(node.x, node.y, dotSize, 0, 2 * Math.PI);
      ctx.fillStyle = isHover ? '#FFB5C2' : (isHighlighted ? '#FFB5C2' : 'rgba(255,181,194,0.3)');
      ctx.fill();
      if (isHover) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, dotSize * 1.6, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,181,194,0.2)';
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    // 正常模式：头像/渐变圆
    const size = Math.max(16 / z, nodeSize);
    const img = avatarCache.current?.[node.id];

    // 外层光晕
    if (isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = isHover ? 'rgba(255,181,194,0.25)' : 'rgba(255,181,194,0.1)';
      ctx.fill();
    }

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
      // 渐变背景
      try {
        const g = ctx.createRadialGradient(node.x - size * 0.3, node.y - size * 0.3, 0, node.x, node.y, size);
        g.addColorStop(0, '#FFE0E8');
        g.addColorStop(0.6, '#FFD6DE');
        g.addColorStop(1, '#DFD0FF');
        ctx.fillStyle = g;
      } catch { ctx.fillStyle = '#FFD6DE'; }
      ctx.fill();

      // 首字
      ctx.fillStyle = '#3D2B1F';
      ctx.font = `bold ${Math.max(14, size * 0.55)}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name.charAt(0), node.x, node.y);
    }

    // 边框
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    if (isHover) {
      ctx.strokeStyle = '#FFB5C2';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,181,194,0.35)';
      ctx.lineWidth = 6;
      ctx.stroke();
    } else {
      ctx.strokeStyle = isHighlighted ? 'rgba(255,181,194,0.7)' : 'rgba(255,181,194,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 名字标签（z >= 0.6）
    if (isHighlighted && z >= 0.6 && textOpacity > 0) {
      const fontSize = 13;
      ctx.globalAlpha = opacity * (textOpacity / 100);
      ctx.font = `600 ${fontSize}px "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(node.name).width;
      const pad = 6;
      const bgX = node.x - tw / 2 - pad;
      const bgY = node.y + size + 6;

      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      drawRoundRect(ctx, bgX, bgY, tw + pad * 2, fontSize + pad * 2, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#3D2B1F';
      ctx.fillText(node.name, node.x, bgY + pad);
    }

    ctx.restore();
  }, [settings, highlightNodes, hoverNode, avatarCache]);

  // 连线绘制
  const linkCanvasObject = useCallback((link, ctx) => {
    const s = link.source;
    const t = link.target;
    if (typeof s !== 'object' || typeof t !== 'object' || s.x == null || t.x == null) return;

    const z = zoomRef.current;
    const { linkThickness } = settings;
    const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(link.id);
    const opacity = isHighlighted ? 0.8 : 0.05;
    const midX = (s.x + t.x) / 2;
    const midY = (s.y + t.y) / 2;
    const color = REL_COLORS[link.type] || '#FFB5C2';

    ctx.save();
    ctx.globalAlpha = opacity;

    const lineWidth = Math.max(0.5 / z, linkThickness * (isHighlighted ? 1 : 0.3));

    // 连线（柔和曲线）
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // 关系标签（z >= 0.5 且高亮时）
    if (isHighlighted && z >= 0.5) {
      const text = link.type;
      ctx.font = `500 ${z >= 0.8 ? 12 : 10}px "Noto Sans SC", sans-serif`;
      const tw = ctx.measureText(text).width;
      const pad = 10;
      const bgW = tw + pad * 2;
      const bgH = 24;

      ctx.shadowColor = 'rgba(0,0,0,0.04)';
      ctx.shadowBlur = 3;
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
  }, [settings, highlightLinks]);

  return { nodeCanvasObject, linkCanvasObject, handleZoom, zoomRef };
}

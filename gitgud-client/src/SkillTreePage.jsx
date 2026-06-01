// SkillTreePage.jsx
// Drop this file into: gitgud-client/src/SkillTreePage.jsx
// Changes: hover tooltips on nodes, reset skill tree feature

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from './context/ThemeContext';
import { useSkillTree } from './skilltree/useSkillTree';
import { SKILL_NODES, SKILL_MAP, skillPointsForLevel } from './skilltree/skillTreeData';
import { clearLevelUpFlag } from './skilltree/skillTreeEngine';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import './SkillTreePage.css';

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 140;
const NODE_H = 70;
const H_GAP  = 60;
const V_GAP  = 110;

function computeLayout(nodes) {
  const byLevel = {};
  nodes.forEach(n => { if (!byLevel[n.level]) byLevel[n.level] = []; byLevel[n.level].push(n); });
  const positions = {};
  const CANVAS_W = 1900;

  const l0 = byLevel[0] ?? [];
  l0.forEach(n => { positions[n.id] = { x: CANVAS_W / 2 - NODE_W / 2, y: 20 }; });

  const l1 = byLevel[1] ?? [];
  const spacing = 450;
  const totalWidth = (l1.length - 1) * spacing; l1.forEach((n, i) => { positions[n.id] = { x: CANVAS_W / 2 - totalWidth / 2 + i * spacing - NODE_W / 2, y: 20 + NODE_H + V_GAP, }; });

  const l2 = byLevel[2] ?? [];

  const level2Spacing = 190; // adjust as needed
  const level2Width = (l2.length - 1) * level2Spacing;

  l2.forEach(n => {
  const parentId = n.parentIds[0];
  const parentPos = positions[parentId];
  const siblings = l2.filter(s => s.parentIds[0] === parentId);
  const idx = siblings.indexOf(n);
  const offset = (idx - (siblings.length - 1) / 2) * 250;

  positions[n.id] = {
    x: parentPos.x + NODE_W / 2 + offset - NODE_W / 2,
    y: parentPos.y + NODE_H + V_GAP
  };
});

  const l3 = byLevel[3] ?? [];
  l3.forEach(n => {
    const parentId = n.parentIds[0];
    const parentPos = positions[parentId];
    positions[n.id] = { x: parentPos.x, y: parentPos.y + NODE_H + V_GAP };
  });

  const xs = Object.values(positions).map(p => p.x);

const minX = Math.min(...xs);
const maxX = Math.max(...xs) + NODE_W;

const treeWidth = maxX - minX;
const offsetX = (CANVAS_W - treeWidth) / 2 - minX;

Object.values(positions).forEach(pos => {
  pos.x += offsetX;
});

  return positions;
}

function Connector({ fromPos, toPos, active }) {
  const x1 = fromPos.x + NODE_W / 2; const y1 = fromPos.y + NODE_H;
  const x2 = toPos.x   + NODE_W / 2; const y2 = toPos.y;
  const cy = (y1 + y2) / 2;
  return (
    <path d={`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}
      fill="none" stroke={active ? 'var(--st-line-active)' : 'var(--st-line)'}
      strokeWidth={active ? 3 : 1.5} strokeDasharray={active ? 'none' : '5 4'} className="st-connector" />
  );
}

// ── Node — reports hover position via callback so tooltip renders above SVG ──
function SkillNode({ node, pos, isUnlocked, isAvailable, isPending, onClick, onHover }) {
  let stateClass = 'st-node';
  if (isUnlocked)       stateClass += ' unlocked';
  else if (isAvailable) stateClass += ' available';
  else                  stateClass += ' locked';
  if (isPending)        stateClass += ' pending';

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={() => isAvailable && !isUnlocked && onClick(node.id)}
      onMouseEnter={e => onHover(node, e.currentTarget)}
      onMouseLeave={() => onHover(null, null)}
      style={{ cursor: isAvailable && !isUnlocked ? 'pointer' : 'default' }}
      className={stateClass}
      role="button"
      aria-label={`${node.label} – ${isUnlocked ? 'unlocked' : isAvailable ? 'click to unlock' : 'locked'}`}
    >
      {/* Node body */}
      <rect width={NODE_W} height={NODE_H} rx={10} className="st-node-rect" />
      <text x={8} y={16} className="st-node-type">{node.type === 'passive' ? '⚙ passive' : '▶ active'}</text>
      <text x={NODE_W / 2} y={36} textAnchor="middle" className="st-node-icon">{node.icon}</text>
      <text x={NODE_W / 2} y={56} textAnchor="middle" className="st-node-label">{node.label}</text>
      {!isUnlocked && !isAvailable && <text x={NODE_W - 12} y={16} className="st-lock">🔒</text>}
      {isUnlocked && <text x={NODE_W - 12} y={16} className="st-check">✓</text>}
    </g>
  );
}

// ── Hover tooltip rendered as HTML above everything ───────────────────────────
function HoverTooltip({ node, anchorEl, isUnlocked, isAvailable, canvasWrapRef }) {
  if (!node || !anchorEl || !canvasWrapRef.current) return null;

  const wrapRect   = canvasWrapRef.current.getBoundingClientRect();
  const nodeRect   = anchorEl.getBoundingClientRect();

  // Position relative to the canvas wrapper
  const nodeLeft   = nodeRect.left - wrapRect.left;
  const nodeTop    = nodeRect.top  - wrapRect.top;
  const nodeCenterX = nodeLeft + nodeRect.width / 2;

  const TOOLTIP_W = 180;
  const TOOLTIP_H = 180;

  // Prefer right; flip left if it would overflow the wrapper
  let left = nodeCenterX + nodeRect.width / 2 + 8;
  if (left + TOOLTIP_W > wrapRect.width) {
    left = nodeCenterX - nodeRect.width / 2 - TOOLTIP_W - 8;
  }
  const top = nodeTop - 10;

  return (
    <div
      className="st-node-tooltip"
      style={{
        position: 'absolute',
        left,
        top,
        width: TOOLTIP_W,
        minHeight: TOOLTIP_H,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <strong className="st-nt-title">{node.label}</strong>
      <span className={`st-nt-badge ${node.type}`}>{node.type}</span>
      <p className="st-nt-desc">{node.description}</p>
      <span className="st-nt-status">
        {isUnlocked ? '✓ Unlocked' : isAvailable ? '⬆ Click to unlock' : '🔒 Locked'}
      </span>
    </div>
  );
}

// ── Reset confirmation modal ──────────────────────────────────────────────────
function ResetModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="st-overlay" onClick={onCancel}>
      <div className="st-tooltip" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <button className="st-tooltip-close" onClick={onCancel} aria-label="Close">✕</button>
        <div className="st-tooltip-icon">⚠️</div>
        <h3 className="st-tooltip-title">Reset Skill Tree?</h3>
        <p className="st-tooltip-desc">
          All your unlocked perks will be returned and your skill points refunded. This lets you reassign them from scratch.<br /><br />
          <strong>This cannot be undone.</strong>
        </p>
        <button
          className="st-tooltip-unlock"
          onClick={onConfirm}
          disabled={loading}
          style={{ background: '#ef4444', marginBottom: 10 }}
        >
          {loading ? 'Resetting…' : '⚠️ Yes, Reset All Perks'}
        </button>
        <button
          className="st-tooltip-unlock"
          onClick={onCancel}
          style={{ background: 'transparent', color: 'var(--st-text)', border: '1px solid var(--st-border)', marginTop: 4 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Click-to-unlock tooltip overlay ──────────────────────────────────────────
function NodeTooltip({ node, isUnlocked, isAvailable, onUnlock, onClose }) {
  if (!node) return null;
  return (
    <div className="st-overlay" onClick={onClose}>
      <div className="st-tooltip" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button className="st-tooltip-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="st-tooltip-icon">{node.icon}</div>
        <h3 className="st-tooltip-title">{node.label}</h3>
        <span className={`st-tooltip-badge ${node.type}`}>{node.type}</span>
        <p className="st-tooltip-desc">{node.description}</p>
        {!isUnlocked && isAvailable && (
          <button className="st-tooltip-unlock" onClick={() => onUnlock(node.id)}>Unlock Perk</button>
        )}
        {isUnlocked && <p className="st-tooltip-status">✓ Already unlocked</p>}
        {!isUnlocked && !isAvailable && (
          <p className="st-tooltip-status locked">🔒 Unlock prerequisites first</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SkillTreePage({ user }) {
  const { theme } = useTheme();
  const isDark = theme?.toLowerCase() === 'dark';

  const {
    unlockedPerks,
    pendingLevelUp,
    level,
    xp,
    loading,
    unlock,
    dismissLevelUp,
  } = useSkillTree(user?.uid);

  const [selectedNode,   setSelectedNode]   = useState(null);
  const [showReset,      setShowReset]       = useState(false);
  const [resetLoading,   setResetLoading]    = useState(false);
  const [toast,          setToast]           = useState(null);

  // Hover tooltip state
  const [hoveredNode,    setHoveredNode]     = useState(null);
  const [hoveredAnchor,  setHoveredAnchor]   = useState(null);
  const canvasWrapRef = useRef(null);

  useEffect(() => { dismissLevelUp(); }, [dismissLevelUp]);

  const positions = computeLayout(SKILL_NODES);

  const totalPoints = skillPointsForLevel(level);
  const spentPoints = unlockedPerks.filter(p => p !== 'start').length;
  const freePoints  = totalPoints - spentPoints;

  const isUnlocked  = (id) => unlockedPerks.includes(id) || id === 'start';
  const isAvailable = (id) => {
    if (isUnlocked(id)) return false;
    if (freePoints <= 0) return false;
    const node = SKILL_MAP[id];
    return node.parentIds.every(pid => isUnlocked(pid));
  };

  const handleUnlock = useCallback(async (perkId) => {
    const result = await unlock(perkId);
    if (result.success) {
      setToast({ type: 'success', msg: `🎉 Unlocked: ${SKILL_MAP[perkId]?.label}!` });
      setSelectedNode(null);
    } else {
      setToast({ type: 'error', msg: result.error });
    }
    setTimeout(() => setToast(null), 3000);
  }, [unlock]);

  // ── Reset skill tree ────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!user?.uid) return;
    setResetLoading(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', user.uid);
        const snap = await tx.get(userRef);
        if (!snap.exists()) return;
        tx.update(userRef, {
          'skillTree.unlockedPerks': [],
          'skillTree.pendingLevelUp': skillPointsForLevel(snap.data().level ?? 1) > 0,
        });
      });
      setToast({ type: 'success', msg: '🔄 Skill tree reset! All points refunded.' });
      setShowReset(false);
    } catch (err) {
      console.error('[SkillTree] reset error:', err);
      setToast({ type: 'error', msg: 'Reset failed. Please try again.' });
    } finally {
      setResetLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }, [user?.uid]);

  const canvasH = 20 + (NODE_H + V_GAP) * 3 + NODE_H + 40;
  const canvasW = 900;

  if (loading) {
    return (
      <div className={`st-page ${isDark ? 'dark' : 'light'}`}>
        <div className="st-loading">Loading Skill Tree…</div>
      </div>
    );
  }

  const selectedNodeData = selectedNode ? SKILL_MAP[selectedNode] : null;

  return (
    <div className={`st-page ${isDark ? 'dark' : 'light'}`}>
      <div className="st-header">
        <div>
          <h1 className="st-title">⚔ Skill Tree</h1>
          <p className="st-subtitle">Unlock perks to power up your quiz runs</p>
        </div>
        <div className="st-stats">
          <div className="st-stat">
            <span className="st-stat-label">Level</span>
            <span className="st-stat-value">{level}</span>
          </div>
          <div className="st-stat">
            <span className="st-stat-label">XP</span>
            <span className="st-stat-value">{xp}</span>
          </div>
          <div className="st-stat">
            <span className="st-stat-label">Skill Points</span>
            <span className="st-stat-value" style={{ color: freePoints > 0 ? 'var(--st-available)' : 'inherit' }}>
              {freePoints} / {totalPoints}
            </span>
          </div>
        </div>
        {/* Reset button */}
        {spentPoints > 0 && (
          <button
            className="st-reset-btn"
            onClick={() => setShowReset(true)}
            title="Refund all skill points and start over"
          >
            🔄 Reset Perks
          </button>
        )}
      </div>

      {freePoints > 0 && (
        <div className="st-banner">
          🌟 You have <strong>{freePoints}</strong> skill point{freePoints > 1 ? 's' : ''} to spend!
          Hover a node to preview it, then click to unlock.
        </div>
      )}

      {/* SVG Tree — wrapper is position:relative so the HTML tooltip can be
          absolutely positioned inside it and always sit above the SVG. */}
      <div className="st-canvas-wrap" ref={canvasWrapRef} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 1900 ${canvasH}`} className="st-canvas" aria-label="Skill tree diagram">
          {/* Connectors */}
          {SKILL_NODES.map(node =>
            node.parentIds.map(parentId => {
              const parentPos = positions[parentId];
              const childPos  = positions[node.id];
              if (!parentPos || !childPos) return null;
              return (
                <Connector key={`${parentId}-${node.id}`} fromPos={parentPos} toPos={childPos}
                  active={isUnlocked(parentId) && isUnlocked(node.id)} />
              );
            })
          )}
          {/* Nodes */}
          {SKILL_NODES.map(node => (
            <SkillNode
              key={node.id}
              node={node}
              pos={positions[node.id]}
              isUnlocked={isUnlocked(node.id)}
              isAvailable={isAvailable(node.id)}
              isPending={pendingLevelUp && isAvailable(node.id)}
              onClick={setSelectedNode}
              onHover={(n, el) => { setHoveredNode(n); setHoveredAnchor(el); }}
            />
          ))}
        </svg>

        {/* Hover tooltip lives outside the SVG so it's never clipped by node stacking order */}
        <HoverTooltip
          node={hoveredNode}
          anchorEl={hoveredAnchor}
          isUnlocked={hoveredNode ? isUnlocked(hoveredNode.id) : false}
          isAvailable={hoveredNode ? isAvailable(hoveredNode.id) : false}
          canvasWrapRef={canvasWrapRef}
        />
      </div>

      {/* Legend */}
      <div className="st-legend">
        <span className="st-legend-item unlocked">✓ Unlocked</span>
        <span className="st-legend-item available">◉ Available (click to unlock)</span>
        <span className="st-legend-item locked">🔒 Locked</span>
        <span className="st-legend-sep" />
        <span className="st-legend-item passive">⚙ Passive — always active when unlocked</span>
        <span className="st-legend-item active-badge">▶ Active — toggle ON in the quiz Skill Perks dropdown</span>
      </div>

      {/* How it works callout */}
      <div className="st-how-wrap">
        <h3 className="st-how-title">How perks work</h3>
        <div className="st-how-grid">
          <div className="st-how-item">
            <span className="st-how-icon">⚙</span>
            <div><strong>Passive perks</strong> apply automatically every quiz — no action needed.</div>
          </div>
          <div className="st-how-item">
            <span className="st-how-icon">▶</span>
            <div><strong>Active perks</strong> must be toggled ON in the <em>Skill Perks</em> dropdown on the quiz page, then triggered via the perk button.</div>
          </div>
          <div className="st-how-item">
            <span className="st-how-icon">📈</span>
            <div><strong>EXP bonuses</strong> are additive: +10% + +50% + +100% = +160% of base. Multipliers (3× chain, 2× double) are also additive.</div>
          </div>
          <div className="st-how-item">
            <span className="st-how-icon">🔥</span>
            <div><strong>3× EXP Chain</strong> activates after 2 consecutive correct answers in a row.</div>
          </div>
        </div>
      </div>

      {/* Click-to-unlock tooltip */}
      {selectedNodeData && (
        <NodeTooltip
          node={selectedNodeData}
          isUnlocked={isUnlocked(selectedNodeData.id)}
          isAvailable={isAvailable(selectedNodeData.id)}
          onUnlock={handleUnlock}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Reset confirmation */}
      {showReset && (
        <ResetModal
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)}
          loading={resetLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`st-toast ${toast.type}`} role="status">{toast.msg}</div>
      )}
    </div>
  );
}

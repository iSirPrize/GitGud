/**
 * SkillPerksDropdown.jsx — UPDATED
 * Drop this file into: gitgud-client/src/components/SkillPerksDropdown.jsx
 *
 * Changes from original:
 *  - Each perk item now shows an inline tooltip on hover with full description,
 *    type, and usage instructions.
 *  - Passive perks show "Always active" tooltip note.
 *  - Active perks show "Toggle ON then use the button during the quiz" note.
 *  - Empty state updated to direct user to Skill Tree page.
 */

import { useState } from 'react';
import './SkillPerksDropdown.css';

// Tooltip that appears on hover over a perk row
function PerkTooltip({ perk, type }) {
  return (
    <div className="spd-item-tooltip" role="tooltip">
      <div className="spd-tt-header">
        <span className="spd-tt-icon">{perk.icon}</span>
        <span className="spd-tt-name">{perk.label}</span>
        <span className={`spd-tt-badge ${type}`}>{type}</span>
      </div>
      <p className="spd-tt-desc">{perk.description}</p>
      <p className="spd-tt-usage">
        {type === 'passive'
          ? '⚙ Always active — no action needed.'
          : '▶ Toggle ON below, then press the perk button during the question.'}
      </p>
    </div>
  );
}

export default function SkillPerksDropdown({
  passivePerks = [],
  activePerks = [],
  sessionActivePerks = [],
  onToggle,
  isDark = false,
}) {
  const [open, setOpen] = useState(false);
  const [hoveredPerk, setHoveredPerk] = useState(null); // id of hovered perk

  const totalPerks = passivePerks.length + activePerks.length;

  return (
    <div className={`spd-wrap ${isDark ? 'dark' : 'light'}`}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        className="spd-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="View and manage your skill perks for this quiz"
      >
        <span className="spd-icon">⚔</span>
        <span className="spd-label">
          Skill Perks{totalPerks > 0 ? ` (${totalPerks})` : ''}
        </span>
        <span className="spd-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="spd-panel" role="listbox" aria-label="Skill perks">

          {totalPerks === 0 && (
            <div className="spd-empty">
              <p>No perks unlocked yet.</p>
              <p className="spd-empty-hint">Visit the <strong>Skill Tree</strong> in the sidebar to unlock perks using your skill points.</p>
            </div>
          )}

          {/* ── Passive perks ─────────────────────────────────────────── */}
          {passivePerks.length > 0 && (
            <section className="spd-section">
              <h4 className="spd-section-title">
                <span className="spd-section-badge passive">⚙ Passive</span>
                Always active
              </h4>
              {passivePerks.map(perk => (
                <div
                  key={perk.id}
                  className="spd-item passive"
                  onMouseEnter={() => setHoveredPerk(perk.id)}
                  onMouseLeave={() => setHoveredPerk(null)}
                >
                  <span className="spd-item-icon">{perk.icon}</span>
                  <div className="spd-item-info">
                    <span className="spd-item-name">{perk.label}</span>
                    <span className="spd-item-desc">{perk.description}</span>
                  </div>
                  <span className="spd-item-status passive">ON</span>

                  {/* Hover tooltip */}
                  {hoveredPerk === perk.id && (
                    <PerkTooltip perk={perk} type="passive" />
                  )}
                </div>
              ))}
            </section>
          )}

          {/* ── Active perks ──────────────────────────────────────────── */}
          {activePerks.length > 0 && (
            <section className="spd-section">
              <h4 className="spd-section-title">
                <span className="spd-section-badge active">▶ Active</span>
                Toggle per quiz
              </h4>
              {activePerks.map(perk => {
                const isOn = sessionActivePerks.includes(perk.id);
                return (
                  <div
                    key={perk.id}
                    className={`spd-item active ${isOn ? 'on' : 'off'}`}
                    onClick={() => onToggle?.(perk.id)}
                    role="option"
                    aria-selected={isOn}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onToggle?.(perk.id)}
                    onMouseEnter={() => setHoveredPerk(perk.id)}
                    onMouseLeave={() => setHoveredPerk(null)}
                  >
                    <span className="spd-item-icon">{perk.icon}</span>
                    <div className="spd-item-info">
                      <span className="spd-item-name">{perk.label}</span>
                      <span className="spd-item-desc">{perk.description}</span>
                    </div>
                    <button
                      className={`spd-toggle-btn ${isOn ? 'on' : 'off'}`}
                      onClick={e => { e.stopPropagation(); onToggle?.(perk.id); }}
                      aria-label={`${isOn ? 'Deactivate' : 'Activate'} ${perk.label}`}
                    >
                      {isOn ? 'ON' : 'OFF'}
                    </button>

                    {/* Hover tooltip */}
                    {hoveredPerk === perk.id && (
                      <PerkTooltip perk={perk} type="active" />
                    )}
                  </div>
                );
              })}

              {/* Usage hint when any active perk is toggled on */}
              {sessionActivePerks.length > 0 && (
                <p className="spd-active-hint">
                  ▶ Perk button will appear during the question — click it to activate.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

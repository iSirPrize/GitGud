/**
 * SkillTreeIndicator.jsx
 * Red "!" badge shown next to the Skill Tree nav link when pendingLevelUp is true.
 * Lightweight wrapper — just a badge driven by Firestore state.
 *
 * Place at: gitgud-client/src/components/SkillTreeIndicator.jsx
 *
 * Usage in Layout.jsx nav:
 *   <NavLink to="/skill-tree" ...>
 *     <div className="nav-main">
 *       Skill Tree <SkillTreeIndicator uid={user.uid} />
 *     </div>
 *     <div className="nav-desc">Spend Skill Points!</div>
 *   </NavLink>
 */

import { useSkillTree } from '../skilltree/useSkillTree';
import './SkillTreeIndicator.css';

export default function SkillTreeIndicator({ uid }) {
  const { pendingLevelUp } = useSkillTree(uid);
  if (!pendingLevelUp) return null;

  return (
    <span className="sti-badge" aria-label="New skill point available!" title="You levelled up! Spend your skill point.">
      !
    </span>
  );
}

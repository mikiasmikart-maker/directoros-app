import type { SceneNode } from '../../models/directoros';
import type { MemoryCategory, MemoryProfile } from '../../types/memory';

interface ProfileBindingSectionProps {
  scene?: SceneNode;
  profiles: MemoryProfile[];
  onBindProfile: (category: MemoryCategory, profileId: string) => void;
}

const categories: MemoryCategory[] = ['character', 'product', 'environment', 'lighting', 'camera'];

export const ProfileBindingSection = ({ scene, profiles, onBindProfile }: ProfileBindingSectionProps) => {
  if (!scene) return <p className="text-xs text-textMuted">Select a scene to bind memory profiles.</p>;

  return (
    <div className="space-y-2.5">
      {categories.map((category) => {
        const categoryProfiles = profiles.filter((profile) => profile.category === category);
        const boundId = scene.memoryBindings?.[category] ?? '';
        const boundProfile = categoryProfiles.find((profile) => profile.id === boundId);

        return (
          <div key={category} className="rounded-md border border-[var(--m6-border-soft)] bg-panelSoft/56 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-textMuted/50">{category}</div>
            <select
              value={boundId}
              onChange={(event) => onBindProfile(category, event.target.value)}
              className="m6-control w-full rounded-md border border-[var(--m6-border-soft)] bg-panel/78 px-2 py-1.5 text-xs text-text/82"
            >
              <option value="">None</option>
              {categoryProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-relaxed text-textMuted/62">
              {boundProfile ? `${boundProfile.sourceType} · ${boundProfile.summary}` : 'No profile bound'}
            </p>
          </div>
        );
      })}
    </div>
  );
};

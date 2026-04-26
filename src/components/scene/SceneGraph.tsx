import type { SceneNode } from '../../models/directoros';

interface SceneGraphProps {
  scenes: SceneNode[];
  selectedSceneId?: string;
  onSelectScene: (id: string) => void;
}

export const SceneGraph = ({ scenes, selectedSceneId, onSelectScene }: SceneGraphProps) => {
  const protocolColors: Record<string, string> = {
    active: "#8144C0",    // Mikart Purple
    neutral: "#737373",   // Neutral Gray
  };

  return (
    <ul className="space-y-1 px-2">
      {scenes
        .filter((s) => s.type === 'scene')
        .map((scene) => {
          const isSelected = selectedSceneId === scene.id;

          return (
            <li key={scene.id}>
              <button
                onClick={() => onSelectScene(scene.id)}
                className={`w-full group relative flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-all duration-200 ease-out ${
                  isSelected
                    ? 'bg-white/[0.03] shadow-[0_4px_12px_rgba(0,0,0,0.1)]'
                    : 'bg-transparent hover:bg-white/[0.015]'
                }`}
              >
                {/* Scene Context Label */}
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-light tracking-[0.05em] ${isSelected ? 'text-white/60' : 'text-neutral-600'}`}>
                    Scene context
                  </span>
                  {isSelected && (
                    <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: protocolColors.active }} />
                  )}
                </div>

                {/* Name & Prompt */}
                <div className="flex flex-col gap-0.5 text-left">
                  <div className={`text-[13px] font-medium tracking-tight ${isSelected ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-400'}`}>
                    {scene.name}
                  </div>
                  <div className="text-[10px] font-light text-neutral-600 truncate leading-relaxed">
                    {scene.prompt}
                  </div>
                </div>

                {/* Selected Indicator Bar */}
                {isSelected && (
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r-full"
                    style={{ backgroundColor: protocolColors.active }}
                  />
                )}
              </button>
            </li>
          );
        })}
    </ul>
  );
};

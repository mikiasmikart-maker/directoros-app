import { memo } from 'react';
import type { SceneNode } from '../../models/directoros';
import { SceneGraph } from '../scene/SceneGraph';
import { Panel } from '../shared/Panel';
import { ReviewInbox } from '../review/ReviewInbox';
import type { InboxItem } from '../../review/reviewLineageTruth';
import { ShiftHandoff, type ShiftHandoffProps } from '../review/ShiftHandoff';

interface LeftSidebarProps {
  scenes: SceneNode[];
  selectedSceneId?: string;
  onSelectScene: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  inboxItems?: InboxItem[];
  onJumpToInboxItem?: (item: InboxItem) => void;
  onRetryInboxItem?: (item: InboxItem) => void;
  onCommitInboxItem?: (item: InboxItem) => void;
  onShootoutInboxItem?: (item: InboxItem) => void;
  onDismissInboxItem?: (item: InboxItem) => void;
  isFocusMode?: boolean;
  selectedFamilyRootId?: string;
  selectedJobId?: string;
  handoff?: ShiftHandoffProps;
  presenceActivities?: import('../../types/presence').PresenceActivity[];
  operators?: import('../../types/presence').Operator[];
  conflicts?: import('../../types/presence').Conflict[];
}

export const LeftSidebar = memo(({
  scenes,
  selectedSceneId,
  onSelectScene,
  isCollapsed = false,
  onToggleCollapse,
  inboxItems = [],
  onJumpToInboxItem,
  onRetryInboxItem,
  onCommitInboxItem,
  onShootoutInboxItem,
  onDismissInboxItem,
  isFocusMode = false,
  selectedFamilyRootId,
  selectedJobId,
  handoff,
  presenceActivities = [],
  operators = [],
  conflicts = [],
}: LeftSidebarProps) => {
  if (isCollapsed) {
    return (
      <aside className={`h-full border-r border-white/5 bg-[#050505] p-1 ${isFocusMode ? 'focus-dim' : ''}`}>
        <button
          type="button"
          aria-label="Expand scenes panel"
          onClick={onToggleCollapse}
          className="group inline-flex h-full w-full items-center justify-center rounded-md border border-white/5 bg-white/[0.02] text-neutral-600 transition-all hover:bg-white/[0.04] hover:text-neutral-400 active:scale-[0.98]"
        >
          <span className="text-lg leading-none transition-transform duration-180 group-hover:translate-x-[1px]">›</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`h-full min-h-0 flex flex-col overflow-hidden border-r border-white/5 bg-[#050505] ${isFocusMode ? 'focus-dim' : ''}`}>
      <Panel
        title="Scenes"
        className="h-full"
        rightSlot={
          <button
            type="button"
            aria-label="Collapse scenes panel"
            onClick={onToggleCollapse}
            className="text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            ‹
          </button>
        }
      >
        <div className="flex h-full flex-col overflow-hidden">
          {handoff && (
            <div className="px-2 pt-2">
              <ShiftHandoff {...handoff} />
            </div>
          )}
          {inboxItems.length > 0 && onJumpToInboxItem && (
            <ReviewInbox 
              items={inboxItems} 
              onJump={onJumpToInboxItem}
              onRetry={onRetryInboxItem}
              onCommit={onCommitInboxItem}
              onShootout={onShootoutInboxItem}
              onDismiss={onDismissInboxItem}
              focusedFamilyRootId={selectedFamilyRootId}
              focusedJobId={selectedJobId}
              presenceActivities={presenceActivities}
              operators={operators}
              conflicts={conflicts}
            />
          )}
          <div className="flex-1 overflow-y-auto overflow-x-hidden pt-1">
            <SceneGraph scenes={scenes} selectedSceneId={selectedSceneId} onSelectScene={onSelectScene} />
          </div>
        </div>
      </Panel>
    </aside>
  );
});


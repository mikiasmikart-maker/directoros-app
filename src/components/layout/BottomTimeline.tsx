import type { TimelineClip } from '../../models/directoros';
import { Panel } from '../shared/Panel';
import { TimelineTrack } from '../timeline/TimelineTrack';

interface BottomTimelineProps {
  clips: TimelineClip[];
  playheadPositionMs: number;
  sessionStartMs: number;
  sessionEndMs: number;
  selectedClipId?: string;
  onSelectClip: (clipId: string) => void;
  onScrub: (posMs: number) => void;
  shotAuthorityMap?: Record<string, { isApproved: boolean; isWinner: boolean }>;
  selectedOverrideClipId?: string;
}

export const BottomTimeline = ({
  clips,
  playheadPositionMs,
  sessionStartMs,
  sessionEndMs,
  selectedClipId,
  onSelectClip,
  onScrub,
  shotAuthorityMap,
  selectedOverrideClipId,
}: BottomTimelineProps) => {
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const msPart = Math.floor((ms % 1000) / 10);
    return `${m}:${s.toString().padStart(2, '0')}.${msPart.toString().padStart(2, '0')}`;
  };

  return (
    <footer className="col-start-2 row-start-2 p-1">
      <Panel
        title="Temporal Map"
        className="border-white/[0.045] bg-[rgba(18,18,20,0.44)] shadow-[0_4px_12px_rgba(2,6,23,0.09)]"
        rightSlot={
          <span className="text-[10px] tabular-nums text-textMuted/78">
            {formatTime(playheadPositionMs - sessionStartMs)} / {formatTime(sessionEndMs - sessionStartMs)}
          </span>
        }
      >
        <TimelineTrack
          clips={clips}
          selectedClipId={selectedClipId}
          onSelectClip={onSelectClip}
          playheadPositionMs={playheadPositionMs}
          sessionStartMs={sessionStartMs}
          sessionEndMs={sessionEndMs}
          onScrub={onScrub}
          shotAuthorityMap={shotAuthorityMap}
          selectedOverrideClipId={selectedOverrideClipId}
        />
      </Panel>
    </footer>
  );
};

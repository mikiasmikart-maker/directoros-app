# App State Model

## appState
```ts
{
  activePanel: 'scene' | 'timeline' | 'inspector';
  selectedSceneId?: string;
  selectedClipId?: string;
  isDarkMode: true;
}
```

## timelineState
```ts
{
  currentFrame: number;
  fps: number;
  duration: number;
  clips: TimelineClip[];
  isPlaying: boolean;
}
```

## renderJob
```ts
{
  id: string;
  sceneId: string;
  status: 'idle' | 'queued' | 'compiling' | 'rendering' | 'complete' | 'error';
  progress: number;
  outputPath?: string;
  error?: string;
}
```

State flows are local and deterministic (no backend/API dependency).

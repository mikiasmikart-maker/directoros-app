# Prototype to Component Mapping

- Header controls -> `components/layout/TopBar.tsx`
- Left navigation/tree -> `components/layout/LeftSidebar.tsx` + `components/scene/SceneGraph.tsx`
- Main canvas/work area -> `components/layout/CenterWorkspace.tsx`
- Bottom edit timeline -> `components/layout/BottomTimeline.tsx` + `components/timeline/TimelineTrack.tsx`
- Right inspector/prompt preview -> `components/layout/RightInspector.tsx` + `components/inspector/InspectorFields.tsx`
- Shared UI wrappers/badges -> `components/shared/Panel.tsx`, `components/shared/StatusBadge.tsx`

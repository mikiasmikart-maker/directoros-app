# DirectorOS Phase 01 - Local Shell

Implemented a local-only modular shell with Vite + React + TypeScript + Tailwind.

## Included
- 5-panel shell layout (top, left, center, bottom timeline, right inspector)
- Typed models + typed mock data
- Local stores for app/selection/timeline/render
- Scene selection flow updates center workspace and inspector
- Render simulation state progression (`queued -> compiling -> rendering -> complete`)
- Local prompt compiler with preview payload JSON
- Dark DaVinci-like styling tokens in Tailwind config

## Build
- `npm install`
- `npm run build`

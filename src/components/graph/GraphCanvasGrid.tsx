export const GraphCanvasGrid = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(20,20,25,0.12)_0%,rgba(10,10,12,0.98)_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:28px_28px] opacity-[0.18]" />
  </div>
);

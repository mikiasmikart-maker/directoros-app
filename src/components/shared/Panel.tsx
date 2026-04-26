import type { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

interface PanelProps extends PropsWithChildren {
  title: string;
  className?: string;
  rightSlot?: ReactNode;
}

export const Panel = ({ title, className, children, rightSlot }: PanelProps) => (
  <section className={clsx('flex flex-col bg-[#0a0a0a] min-h-0', className)}>
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4 text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500 bg-black/20">
      <span className="flex items-center gap-2">
        <div className="w-1 h-3 bg-[#8144C0]" />
        {title}
      </span>
      {rightSlot}
    </header>
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
  </section>
);


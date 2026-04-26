import type { InspectorField, SceneNode } from '../../models/directoros';
import type { PrimitiveValue } from '../../types/memory';

type SourceTag = 'scene' | 'memory' | 'manual' | 'mixed' | 'timeline';

interface InspectorFieldsProps {
  fields: InspectorField[];
  scene?: SceneNode;
  values: Record<string, PrimitiveValue>;
  sources: Record<string, SourceTag>;
  onOverrideChange: (key: string, value: PrimitiveValue) => void;
}

const sourceTone: Record<SourceTag, string> = {
  scene: 'text-slate-300/78 border-slate-300/15 bg-slate-400/5',
  memory: 'text-cyan-300/78 border-cyan-300/20 bg-cyan-500/8',
  manual: 'text-fuchsia-300/78 border-fuchsia-300/20 bg-fuchsia-500/8',
  mixed: 'text-amber-300/80 border-amber-300/20 bg-amber-500/8',
  timeline: 'text-emerald-300/80 border-emerald-300/20 bg-emerald-500/8',
};

const sourceLabels: Record<SourceTag, string> = {
  scene: 'Scene Default',
  memory: 'Memory Pull',
  manual: 'Manual Override',
  mixed: 'Mixed Inputs',
  timeline: 'Timeline Cue',
};

const groupOrder: Array<NonNullable<InspectorField['group']>> = ['shot', 'camera', 'motion', 'style'];
const groupLabels: Record<NonNullable<InspectorField['group']>, string> = {
  shot: 'Shot Intent',
  camera: 'Lens and Framing',
  motion: 'Movement Direction',
  style: 'Atmosphere and Feeling',
};

const toTextValue = (value: PrimitiveValue) => (value == null ? '' : String(value));
const toNumberValue = (value: PrimitiveValue) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
  }
  return '';
};
const toToggleValue = (value: PrimitiveValue) => Boolean(value);

export const InspectorFields = ({ fields, scene, values, sources, onOverrideChange }: InspectorFieldsProps) => {
  if (!scene) return <p className="text-xs text-textMuted">Select a scene to reveal its intelligence controls.</p>;

  const groupedFields = groupOrder
    .map((group) => ({ group, fields: fields.filter((field) => (field.group ?? 'shot') === group) }))
    .filter((entry) => entry.fields.length > 0);

  const renderControl = (field: InspectorField, value: PrimitiveValue) => {
    const baseClassName = 'm6-control mt-1.5 w-full rounded-md border border-[rgba(255,255,255,0.035)] bg-[rgba(9,13,22,0.6)] px-2.5 py-1.5 text-xs font-medium text-text/82';

    if (field.type === 'textarea') {
      return (
        <textarea
          value={toTextValue(value)}
          placeholder={field.placeholder}
          onChange={(event) => onOverrideChange(field.key, event.target.value)}
          rows={3}
          className={`${baseClassName} resize-y`}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={toTextValue(value)}
          onChange={(event) => onOverrideChange(field.key, event.target.value)}
          className={baseClassName}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={toNumberValue(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          onChange={(event) => onOverrideChange(field.key, event.target.value === '' ? '' : Number(event.target.value))}
          className={baseClassName}
        />
      );
    }

    if (field.type === 'range') {
      const numericValue = typeof toNumberValue(value) === 'number' ? Number(toNumberValue(value)) : field.min ?? 0;
      return (
        <div className="mt-1.5 space-y-1.5">
          <input
            type="range"
            value={numericValue}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(event) => onOverrideChange(field.key, Number(event.target.value))}
            className="w-full accent-[rgba(120,160,255,0.9)]"
          />
          <div className="text-[10px] text-slate-400/64">{numericValue}</div>
        </div>
      );
    }

    if (field.type === 'toggle') {
      return (
        <label className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-[rgba(255,255,255,0.035)] bg-[rgba(9,13,22,0.6)] px-2.5 py-2 text-xs text-text/82">
          <span>{toToggleValue(value) ? 'Enabled' : 'Disabled'}</span>
          <input
            type="checkbox"
            checked={toToggleValue(value)}
            onChange={(event) => onOverrideChange(field.key, event.target.checked)}
            className="h-4 w-4 accent-[rgba(120,160,255,0.9)]"
          />
        </label>
      );
    }

    return (
      <input
        type="text"
        value={toTextValue(value)}
        placeholder={field.placeholder}
        onChange={(event) => onOverrideChange(field.key, event.target.value)}
        className={baseClassName}
      />
    );
  };

  return (
    <div className="space-y-4">
      {groupedFields.map(({ group, fields: groupFields }) => (
        <section key={group} className="space-y-2.5">
          <div className="px-0.5 text-[9px] font-light uppercase tracking-[0.14em] text-neutral-500">{groupLabels[group]}</div>
          {groupFields.map((field) => {
            const value = values[field.key];
            const source = sources[field.key] ?? 'scene';

            return (
              <div key={field.key} className="rounded border border-white/5 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-light tracking-[0.05em] text-neutral-400">{field.label}</div>
                    {field.helperText ? <div className="mt-1 text-[9px] font-mono leading-relaxed text-neutral-600">{field.helperText}</div> : null}
                  </div>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.05em] ${sourceTone[source]}`}>{sourceLabels[source]}</span>
                </div>
                {renderControl(field, value)}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};

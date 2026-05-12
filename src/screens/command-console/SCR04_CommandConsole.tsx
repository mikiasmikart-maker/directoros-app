type CommandLogStatus = 'ok' | 'running' | 'blocked' | 'error';

type CommandLogEntry = {
  id: string;
  commandLabel: string;
  runOrSessionLabel: string;
  status: CommandLogStatus;
  occurredAtLabel: string;
  detail?: string;
};

interface SCR04CommandConsoleProps {
  commandInput?: string;
  targetScopeLabel: string;
  quickTemplates?: string[];
  selectedTemplate?: string;
  validationPreviewLabel?: string;
  trustImpactPreviewLabel?: string;
  canonicalContextLabel: string;
  routeSummaryLabel?: string;
  targetSummaryLabel?: string;
  diagnosticsSummaryLabel?: string;
  commandIntentLabel?: string;
  commandRiskLabel?: string;
  expectedResultLabel?: string;
  nextBestActionLabel?: string;
  commandLog?: CommandLogEntry[];
  resultTraceLines?: string[];
  rollbackHints?: string[];
  recentOutcomeSummary?: string;
  onCommandInputChange?: (value: string) => void;
  onSelectTemplate?: (template: string) => void;
  onExecuteCommand?: () => void;
  onDryRunValidate?: () => void;
  onRerunLastCommand?: () => void;
  onOpenImpactedRun?: () => void;
  onSendBlockedToIntervention?: () => void;
  executeDisabled?: boolean;
  executeDisabledReasonLabel?: string;
}

const statusTone: Record<CommandLogStatus, string> = {
  ok: ' bg-emerald-500/10 text-emerald-100',
  running: ' bg-dos-sig-runtime/10 text-dos-sig-runtime',
  blocked: ' bg-amber-500/10 text-amber-100',
  error: ' bg-rose-500/10 text-rose-100',
};

const groupedBySession = (entries: CommandLogEntry[]) => {
  const groups = new Map<string, CommandLogEntry[]>();
  entries.forEach((entry) => {
    const list = groups.get(entry.runOrSessionLabel) ?? [];
    list.push(entry);
    groups.set(entry.runOrSessionLabel, list);
  });
  return Array.from(groups.entries());
};

export const SCR04_CommandConsole = ({
  commandInput = '',
  targetScopeLabel,
  quickTemplates = [],
  selectedTemplate,
  validationPreviewLabel,
  trustImpactPreviewLabel,
  canonicalContextLabel,
  routeSummaryLabel,
  targetSummaryLabel,
  diagnosticsSummaryLabel,
  commandIntentLabel,
  commandRiskLabel,
  expectedResultLabel,
  nextBestActionLabel,
  commandLog = [],
  resultTraceLines = [],
  rollbackHints = [],
  recentOutcomeSummary,
  onCommandInputChange,
  onSelectTemplate,
  onExecuteCommand,
  onDryRunValidate,
  onRerunLastCommand,
  onOpenImpactedRun,
  onSendBlockedToIntervention,
  executeDisabled = false,
  executeDisabledReasonLabel,
}: SCR04CommandConsoleProps) => {
  const grouped = groupedBySession(commandLog);

  return (
    <div className="relative h-full min-w-0 p-3">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] gap-3">
        <section className="m6-tier-2 rounded-md p-3">
          <div className="mb-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="m6-smalltext mb-1 text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Scoped Command Input</div>
              <input
                value={commandInput}
                onChange={(event) => onCommandInputChange?.(event.target.value)}
                placeholder="Enter deterministic command..."
                className="w-full rounded bg-dos-panel/60 px-2.5 py-2 text-[12px] text-dos-text shadow-[0_0_0_1px_var(--dos-border)] outline-none placeholder:text-dos-text-muted/55"
              />
            </div>
            <div className="rounded bg-dos-panel/45 px-2 py-2 text-[10px] uppercase tracking-[0.08em] text-dos-text-muted/60">
              target/scope: <span className="text-dos-text/92">{targetScopeLabel}</span>
            </div>
          </div>

          <div className="mb-2 grid gap-1.5 text-[10px] uppercase tracking-wide lg:grid-cols-4">
            <div className="rounded bg-dos-panel/45 px-2 py-1 text-dos-text-muted">intent: <span className="text-dos-text/92">{commandIntentLabel ?? 'n/a'}</span></div>
            <div className="rounded bg-dos-sig-warning/8 px-2 py-1 text-dos-sig-warning">risk: {commandRiskLabel ?? 'n/a'}</div>
            <div className="rounded bg-dos-sig-runtime/8 px-2 py-1 text-dos-sig-runtime">expected: {expectedResultLabel ?? 'n/a'}</div>
            <div className="rounded bg-dos-sig-continuity/10 px-2 py-1 text-dos-sig-continuity">next: {nextBestActionLabel ?? 'n/a'}</div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-1.5">
              {quickTemplates.length ? (
                quickTemplates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => onSelectTemplate?.(template)}
                    className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide ${selectedTemplate === template ? ' bg-dos-sig-runtime/12 text-dos-sig-runtime' : ' bg-dos-panel/45 text-dos-text-muted hover:text-dos-text'}`}
                  >
                    {template}
                  </button>
                ))
              ) : (
                <span className="rounded bg-dos-panel/40 px-2 py-1 text-[10px] uppercase tracking-wide text-dos-text-muted">No templates</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
              <button type="button" disabled={executeDisabled} onClick={onExecuteCommand} className="rounded bg-dos-sig-runtime/12 px-2.5 py-1 text-dos-sig-runtime disabled:cursor-not-allowed disabled:opacity-40">Execute</button>
              <button type="button" onClick={onDryRunValidate} className="rounded bg-dos-sig-runtime/10 px-2.5 py-1 text-dos-sig-runtime">Dry-run / Validate</button>
              <button type="button" onClick={onRerunLastCommand} className="rounded px-2.5 py-1 text-dos-text-muted hover:text-dos-text">Rerun Last</button>
            </div>
          </div>
          {executeDisabledReasonLabel ? (
            <div className="mt-2 rounded bg-dos-sig-warning/8 px-2 py-1 text-[10px] uppercase tracking-wide text-dos-sig-warning">
              execute unavailable: {executeDisabledReasonLabel}
            </div>
          ) : null}
        </section>

        <section className="grid min-h-0 gap-3 [grid-template-columns:minmax(0,6fr)_minmax(0,4fr)]">
          <section className="m6-tier-2 min-h-0 rounded-md p-3">
            <div className="m6-smalltext mb-2 text-[10px] font-normal uppercase tracking-[0.14em] text-slate-500/62">Command Log</div>
            <div className="max-h-[54vh] space-y-2 overflow-auto pr-0.5">
              {grouped.length ? (
                grouped.map(([groupLabel, entries]) => (
                  <div key={groupLabel} className="rounded bg-dos-panel/40 p-2">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-text-muted/80">{groupLabel}</div>
                    <div className="space-y-1.5">
                      {entries.map((entry) => (
                        <div key={entry.id} className="rounded bg-dos-panel/45 px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-dos-text/92">{entry.commandLabel}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${statusTone[entry.status]}`}>{entry.status}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-dos-text-muted/80">{entry.occurredAtLabel}{entry.detail ? ` • ${entry.detail}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded bg-dos-panel/35 px-2 py-2 text-[11px] text-dos-text-muted/75">No commands logged yet.</div>
              )}
            </div>
          </section>

          <aside className="m6-tier-1 min-h-0 rounded-md p-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-dos-text-muted/62">Command Context</div>
            <div className="space-y-2 text-[11px]">
              <section className="rounded bg-dos-sig-runtime/8 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-sig-runtime/85">Validation Preview</div>
                <div className="text-dos-text/90">{validationPreviewLabel ?? 'No validation preview yet.'}</div>
              </section>
              <section className="rounded bg-dos-sig-continuity/8 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-sig-continuity/85">Trust Impact Preview</div>
                <div className="text-dos-text/90">{trustImpactPreviewLabel ?? 'No trust impact preview yet.'}</div>
              </section>
              <section className="rounded bg-dos-panel/40 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-text-muted/90">Canonical Context</div>
                <div className="text-dos-text/92">{canonicalContextLabel}</div>
              </section>
              <section className="rounded bg-dos-panel/40 p-2">
                <div className="grid gap-1 text-[10px] uppercase tracking-wide text-dos-text-muted/85">
                  <div>route: <span className="text-dos-text/92">{routeSummaryLabel ?? 'n/a'}</span></div>
                  <div>target: <span className="text-dos-text/92">{targetSummaryLabel ?? 'n/a'}</span></div>
                  <div>diagnostics: <span className="text-dos-text/92">{diagnosticsSummaryLabel ?? 'n/a'}</span></div>
                </div>
              </section>
              <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                <button type="button" onClick={onOpenImpactedRun} className="rounded bg-dos-sig-runtime/10 px-2 py-1 text-dos-sig-runtime">Open Impacted Run</button>
                <button type="button" onClick={onSendBlockedToIntervention} className="rounded bg-rose-500/10 px-2 py-1 text-rose-100">Send to Intervention Queue</button>
              </div>
            </div>
          </aside>
        </section>

        <section className="m6-tier-3 rounded-md p-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-dos-text-muted/62">Result Trace</div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="max-h-28 space-y-1 overflow-auto rounded bg-dos-panel/30 p-2 font-mono text-[10px] text-dos-sig-runtime/90">
              {resultTraceLines.length ? resultTraceLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div className="text-dos-text-muted/70">No trace lines yet.</div>}
            </div>
            <div className="space-y-2">
              <div className="rounded bg-dos-panel/40 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-text-muted/80">Rollback Hints</div>
                {rollbackHints.length ? (
                  <ul className="space-y-0.5 text-[11px] text-dos-text/90">
                    {rollbackHints.map((hint, index) => <li key={`${hint}-${index}`}>• {hint}</li>)}
                  </ul>
                ) : (
                  <div className="text-[11px] text-dos-text-muted/75">No rollback hints.</div>
                )}
              </div>
              <div className="rounded bg-dos-panel/40 p-2 text-[11px] text-dos-text/90">
                <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-dos-text-muted/80">Recent Outcome</div>
                {recentOutcomeSummary ?? 'No recent outcome summary.'}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

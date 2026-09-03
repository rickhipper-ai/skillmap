import { useState } from 'react';

import type { ProgressCommand, ProgressHistoryEvent, StepState, TrailProgress } from './api';

interface ProgressControlsProps {
  progress: TrailProgress;
  stepTitles: ReadonlyMap<string, string>;
  busy: boolean;
  onCommand(command: ProgressCommand): Promise<void>;
}

const stateLabels: Record<StepState, string> = {
  not_started: 'Nao iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluida',
};

export function ProgressControls({ progress, stepTitles, busy, onCommand }: ProgressControlsProps) {
  const [correctionStepId, setCorrectionStepId] = useState<string | null>(null);

  return (
    <section aria-labelledby="progress-steps-title">
      <h2 id="progress-steps-title">Etapas atuais</h2>
      <ol className="progress-steps">
        {progress.steps.map((step) => {
          const title = stepTitles.get(step.stepId) ?? `Etapa ${step.stepId}`;
          const events = progress.history.filter((event) => event.stepId === step.stepId);
          const pending = step.pendingPrerequisiteStepIds ?? [];
          return (
            <li key={step.stepId}>
              <div>
                <h3>{title}</h3>
                <p className="step-state">Estado: {stateLabels[step.state]}</p>
                {pending.length > 0 && (
                  <p className="pending-prerequisites">
                    Pendente: {pending.map((id) => stepTitles.get(id) ?? id).join(', ')}
                  </p>
                )}
              </div>
              <div className="progress-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || step.state === 'in_progress'}
                  onClick={() =>
                    void onCommand({
                      stepId: step.stepId,
                      state: 'in_progress',
                      baseStreamVersion: progress.streamVersion,
                    }).catch(() => undefined)
                  }
                >
                  Iniciar {title}
                </button>
                <button
                  type="button"
                  disabled={busy || !step.eligible || step.state === 'completed'}
                  aria-describedby={pending.length ? `pending-${step.stepId}` : undefined}
                  onClick={() =>
                    void onCommand({
                      stepId: step.stepId,
                      state: 'completed',
                      baseStreamVersion: progress.streamVersion,
                    }).catch(() => undefined)
                  }
                >
                  Concluir {title}
                </button>
                {pending.length > 0 && (
                  <span id={`pending-${step.stepId}`} className="visually-hidden">
                    Requisitos pendentes
                  </span>
                )}
                {events.length > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    aria-expanded={correctionStepId === step.stepId}
                    onClick={() =>
                      setCorrectionStepId((current) =>
                        current === step.stepId ? null : step.stepId,
                      )
                    }
                  >
                    Corrigir {title}
                  </button>
                )}
              </div>
              {correctionStepId === step.stepId && (
                <CorrectionForm
                  stepId={step.stepId}
                  events={events}
                  streamVersion={progress.streamVersion}
                  busy={busy}
                  onCommand={async (command) => {
                    await onCommand(command);
                    setCorrectionStepId(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CorrectionForm({
  stepId,
  events,
  streamVersion,
  busy,
  onCommand,
}: {
  stepId: string;
  events: ProgressHistoryEvent[];
  streamVersion: number;
  busy: boolean;
  onCommand(command: ProgressCommand): Promise<void>;
}) {
  const [eventId, setEventId] = useState(String(events.at(-1)?.eventId ?? ''));
  const [state, setState] = useState<StepState>('not_started');
  return (
    <form
      className="correction-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onCommand({
          stepId,
          state,
          baseStreamVersion: streamVersion,
          supersedesEventId: Number(eventId),
        }).catch(() => undefined);
      }}
    >
      <label htmlFor={`correction-event-${stepId}`}>Evento a corrigir</label>
      <select
        id={`correction-event-${stepId}`}
        value={eventId}
        onChange={(event) => setEventId(event.target.value)}
      >
        {events.map((event) => (
          <option key={event.eventId} value={event.eventId}>
            #{event.eventId} - {stateLabels[event.state]}
          </option>
        ))}
      </select>
      <label htmlFor={`correction-state-${stepId}`}>Estado correto</label>
      <select
        id={`correction-state-${stepId}`}
        value={state}
        onChange={(event) => setState(event.target.value as StepState)}
      >
        {Object.entries(stateLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy || !eventId}>
        Registrar correcao
      </button>
    </form>
  );
}

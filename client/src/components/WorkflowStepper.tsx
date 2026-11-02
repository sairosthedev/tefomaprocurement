import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, X } from 'lucide-react';

export type StepState = 'done' | 'current' | 'upcoming' | 'stopped';

export interface WorkflowStep {
  key: string;
  label: string;
  state: StepState;
  /** A record number or short status shown under the label. */
  detail?: string;
  /** Opens the record behind this step. */
  to?: string;
}

/**
 * Where one purchase stands, from requisition to delivery. Finished steps link
 * to their records, so the next one never needs a trip back through a list.
 */
export function WorkflowStepper({ steps, compact }: { steps: WorkflowStep[]; /** Inside a modal or panel: no card of its own. */ compact?: boolean }) {
  const frame = compact
    ? 'py-2 mb-4'
    : 'bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6';
  return (
    <ol className={`flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0 ${frame}`}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const circle =
          step.state === 'done'
            ? 'bg-green-600 text-white border-green-600'
            : step.state === 'current'
              ? 'bg-primary text-white border-primary ring-4 ring-primary/15'
              : step.state === 'stopped'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-400 border-gray-300';
        const label =
          step.state === 'upcoming' ? 'text-gray-400' : step.state === 'stopped' ? 'text-red-700' : 'text-gray-900';

        const body = (
          <>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${circle}`}>
              {step.state === 'done' ? <Check className="h-4 w-4" /> : step.state === 'stopped' ? <X className="h-4 w-4" /> : i + 1}
            </span>
            <span className="min-w-0 sm:text-center">
              <span className={`block text-xs font-semibold ${label}`}>{step.label}</span>
              {step.detail && (
                <span className={`block text-[11px] truncate ${step.to ? 'text-primary group-hover:underline' : 'text-gray-500'}`}>
                  {step.detail}
                </span>
              )}
            </span>
          </>
        );

        return (
          <li key={step.key} className="relative flex-1 min-w-0" aria-current={step.state === 'current' ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden
                className={`hidden sm:block absolute top-4 left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] h-0.5 ${step.state === 'done' ? 'bg-green-600' : 'bg-gray-200'}`}
              />
            )}
            {step.to ? (
              <Link to={step.to} className="group flex sm:flex-col items-center gap-3 sm:gap-1.5 sm:px-1">
                {body}
              </Link>
            ) : (
              <div className="flex sm:flex-col items-center gap-3 sm:gap-1.5 sm:px-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface NextStepAction {
  label: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * The one thing to do next on this record, and the button that does it.
 * `waiting` is for steps that belong to someone else; `done` for a record
 * whose process has finished, where the button only opens what followed.
 */
export function NextStepCard({
  title,
  description,
  action,
  waiting,
  done
}: {
  title: string;
  description?: string;
  action?: NextStepAction;
  waiting?: boolean;
  done?: boolean;
}) {
  const tone = done
    ? 'bg-green-50 border-green-200'
    : waiting
      ? 'bg-amber-50 border-amber-200'
      : 'bg-primary/5 border-primary/20';
  const button =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border p-4 sm:p-5 mb-6 ${tone}`}>
      <div className="min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-wide ${done ? 'text-green-700' : waiting ? 'text-amber-700' : 'text-primary'}`}>
          {done ? 'Complete' : waiting ? 'Waiting on' : 'Next step'}
        </p>
        <p className="font-semibold text-gray-900">{title}</p>
        {description && <p className="text-sm text-gray-600 mt-0.5">{description}</p>}
      </div>
      {action &&
        (action.to ? (
          <Link to={action.to} className={button}>
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} disabled={action.disabled} className={button}>
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        ))}
    </div>
  );
}

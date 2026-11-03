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
 * Where one purchase stands, from requisition to delivery. Always horizontal
 * with overflow-scroll so it never pushes the page into vertical expansion.
 */
export function WorkflowStepper({ steps, compact }: { steps: WorkflowStep[]; compact?: boolean }) {
  const frame = compact
    ? 'py-1 mb-3'
    : 'bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-4';
  return (
    <div className={`overflow-x-auto ${frame}`}>
      <ol className="flex items-start gap-0 min-w-max">
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
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${circle}`}>
                {step.state === 'done' ? <Check className="h-3.5 w-3.5" /> : step.state === 'stopped' ? <X className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="text-center mt-1 w-16">
                <span className={`block text-[11px] font-semibold leading-tight ${label}`}>{step.label}</span>
                {step.detail && (
                  <span className={`block text-[10px] truncate ${step.to ? 'text-primary group-hover:underline' : 'text-gray-500'}`}>
                    {step.detail}
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li key={step.key} className="relative flex-1" aria-current={step.state === 'current' ? 'step' : undefined}>
              {!last && (
                <span
                  aria-hidden
                  className={`absolute top-3.5 left-[calc(50%+1.1rem)] right-[calc(-50%+1.1rem)] h-0.5 ${step.state === 'done' ? 'bg-green-600' : 'bg-gray-200'}`}
                />
              )}
              {step.to ? (
                <Link to={step.to} className="group flex flex-col items-center px-1">
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col items-center px-1">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
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
    'inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 shrink-0';

  return (
    <div className={`flex items-center gap-3 justify-between rounded-xl border px-4 py-2.5 mb-4 ${tone}`}>
      <div className="min-w-0 flex items-center gap-2">
        <p className={`text-[11px] font-semibold uppercase tracking-wide shrink-0 ${done ? 'text-green-700' : waiting ? 'text-amber-700' : 'text-primary'}`}>
          {done ? 'Complete' : waiting ? 'Waiting on' : 'Next step'}
        </p>
        <span className="text-gray-300 text-xs">·</span>
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        {description && <p className="text-xs text-gray-500 hidden sm:block truncate">{description}</p>}
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

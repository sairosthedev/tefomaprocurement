import React from 'react';
import { Check, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

export interface FormStep {
  label: string;
  description?: string;
}

/**
 * The step header of a multi-step form. Earlier steps can be revisited by
 * clicking them; later ones open only through Next, so each step's checks run.
 *
 * `variant="track"` draws a lighter header: a dot per step on one connecting
 * line, with the label and description centred underneath.
 */
export function FormSteps({
  steps,
  current,
  onSelect,
  variant = 'bar'
}: {
  steps: FormStep[];
  current: number;
  onSelect?: (index: number) => void;
  variant?: 'bar' | 'track';
}) {
  if (variant === 'track') {
    return (
      <ol className="grid mb-8" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done && !!onSelect;
          return (
            <li key={step.label} className="relative min-w-0">
              {/* Line to the next dot: coloured once that step has been reached. */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute top-[5px] left-[calc(50%+12px)] h-0.5 w-[calc(100%-24px)] rounded-full ${
                    i < current ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect?.(i)}
                aria-current={active ? 'step' : undefined}
                className={`group flex w-full flex-col items-center text-center px-2 ${
                  clickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <span className="flex h-3 items-center">
                  <span
                    className={`block rounded-full ${
                      active ? 'h-3 w-3 bg-primary' : done ? 'h-2 w-2 bg-primary' : 'h-2 w-2 bg-gray-300'
                    }`}
                  />
                </span>
                <span
                  className={`mt-3 text-sm truncate max-w-full ${
                    active ? 'font-medium text-gray-900' : done ? 'text-gray-800' : 'text-gray-400'
                  } ${clickable ? 'group-hover:text-primary' : ''}`}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span
                    className={`hidden sm:block mt-0.5 text-xs truncate max-w-full ${
                      active ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {step.description}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onSelect;
        return (
          <li key={step.label} className="min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect?.(i)}
              aria-current={active ? 'step' : undefined}
              className={`w-full text-left rounded-xl border-t-4 pt-2 px-1 ${
                active ? 'border-primary' : done ? 'border-green-600' : 'border-gray-200'
              } ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done ? 'bg-green-600 text-white' : active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={`text-sm font-semibold truncate ${active || done ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </span>
              {step.description && (
                <span className="hidden md:block text-xs text-gray-500 mt-0.5 truncate">{step.description}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Back / Next / finish buttons for the bottom of each step. The page's
 * `onNext` checks the current step and only advances once it is complete.
 * The last step's button is `type="submit"`, so place this inside the form.
 */
export function FormStepNav({
  current,
  total,
  onBack,
  onNext,
  onCancel,
  finishLabel,
  submitting,
  extra,
  size = 'md'
}: {
  current: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onCancel?: () => void;
  /** Label of the last step's button; the button submits the form. */
  finishLabel: string;
  submitting?: boolean;
  /** Further buttons on the last step, such as "Save as draft". */
  extra?: React.ReactNode;
  /** `sm` matches the page's compact toolbar buttons, for forms hosted in a drawer. */
  size?: 'md' | 'sm';
}) {
  const last = current === total - 1;
  // Outlined buttons get 1px less padding so their border doesn't make them taller than the filled ones.
  const outlined = size === 'sm' ? 'px-3 py-[7px] text-sm rounded-lg gap-1.5' : 'px-5 py-2.5 rounded-xl gap-2';
  const filled = size === 'sm' ? 'px-3 py-2 text-sm rounded-lg gap-1.5' : 'px-6 py-2.5 rounded-xl gap-2';
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-6 mt-6 border-t border-gray-100">
      <div className="flex gap-3">
        {current > 0 ? (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className={`inline-flex items-center ${outlined} border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`inline-flex items-center ${outlined} border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors`}
            >
              Cancel
            </button>
          )
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {last && extra}
        {/* Distinct keys: reusing one element would switch it to type="submit"
            mid-click on the second-to-last step and submit the form early. */}
        {last ? (
          <button
            key="finish"
            type="submit"
            disabled={submitting}
            className={`inline-flex items-center justify-center ${filled} bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {finishLabel}
          </button>
        ) : (
          <button
            key="next"
            type="button"
            onClick={onNext}
            className={`inline-flex items-center justify-center ${filled} bg-primary text-white font-medium hover:bg-primary-dark transition-colors`}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

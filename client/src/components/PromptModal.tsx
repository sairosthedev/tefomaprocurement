import React, { useRef, useState } from 'react';
import { FormErrors, maxLength, minLength, required, type FieldErrors } from '@fossil/shared';

import { Modal, ModalFooter } from './Modal';
import FieldError from './FieldError';
import { useFormValidation } from '../lib/useFormValidation';

export interface PromptField {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** A text area rather than a single line. */
  multiline?: boolean;
  type?: 'text' | 'tel';
  defaultValue?: string;
  /** Required unless set to false. */
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  /** Defaults to 1000. */
  maxLength?: number;
  /** Any further check; return a message, or '' when fine. */
  validate?: (value: string, values: Record<string, string>) => string;
}

export interface PromptOptions {
  title: string;
  subtitle?: string;
  /** A line of explanation above the fields. */
  message?: React.ReactNode;
  fields: PromptField[];
  confirmLabel?: string;
  danger?: boolean;
}

function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function validatePrompt(fields: PromptField[], values: Record<string, string>): FieldErrors {
  const v = new FormErrors();
  for (const field of fields) {
    const value = values[field.name] ?? '';
    v.add(
      field.name,
      field.required === false ? '' : required(value, field.requiredMessage || `Enter ${lowerFirst(field.label)}`),
      field.minLength ? minLength(value, field.minLength, field.label) : '',
      maxLength(value, field.maxLength ?? 1000, field.label),
      value.trim() && field.validate ? field.validate(value.trim(), values) : ''
    );
  }
  return v.errors;
}

/**
 * A small form in a modal, in place of the browser's prompt box, which cannot
 * say what is wrong with an answer.
 *
 *   const { ask, promptElement } = usePrompt();
 *   const answer = await ask({ title: 'Reject document', fields: [{ name: 'reason', label: 'Reason', multiline: true }] });
 *   if (!answer) return;            // cancelled
 *   await reject(answer.reason);    // trimmed
 *   ...
 *   return <>{promptElement} ...</>;
 */
export function usePrompt() {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const resolver = useRef<((answer: Record<string, string> | null) => void) | null>(null);
  const fields = options?.fields || [];
  const form = useFormValidation((current: Record<string, string>) => validatePrompt(fields, current), values);

  const settle = (answer: Record<string, string> | null) => {
    resolver.current?.(answer);
    resolver.current = null;
    setOptions(null);
  };

  const ask = (next: PromptOptions): Promise<Record<string, string> | null> => {
    resolver.current?.(null);
    setValues(Object.fromEntries(next.fields.map((field) => [field.name, field.defaultValue ?? ''])));
    form.reset();
    setOptions(next);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.check()) return;
    settle(Object.fromEntries(fields.map((field) => [field.name, (values[field.name] ?? '').trim()])));
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';

  const promptElement = (
    <Modal isOpen={Boolean(options)} onClose={() => settle(null)} title={options?.title} subtitle={options?.subtitle} size="md">
      <form ref={form.formRef} onSubmit={submit} noValidate className="space-y-4">
        {options?.message && <div className="text-sm text-gray-600">{options.message}</div>}
        {fields.map((field, index) => (
          <div key={field.name}>
            <label htmlFor={`prompt-${field.name}`} className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required === false && <span className="font-normal text-gray-400"> (optional)</span>}
            </label>
            {field.multiline ? (
              <textarea
                id={`prompt-${field.name}`}
                rows={3}
                autoFocus={index === 0}
                value={values[field.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                placeholder={field.placeholder}
                className={inputClass}
                {...form.invalid(field.name)}
              />
            ) : (
              <input
                id={`prompt-${field.name}`}
                type={field.type || 'text'}
                autoFocus={index === 0}
                value={values[field.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                placeholder={field.placeholder}
                className={inputClass}
                {...form.invalid(field.name)}
              />
            )}
            {field.hint && !form.errors[field.name] && <p className="mt-1 text-xs text-gray-500">{field.hint}</p>}
            <FieldError message={form.errors[field.name]} />
          </div>
        ))}
        <ModalFooter>
          <button
            type="button"
            onClick={() => settle(null)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${options?.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {options?.confirmLabel || 'Continue'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );

  return { ask, promptElement };
}

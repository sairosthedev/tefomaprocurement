import { useEffect, useRef, useState } from 'react';
import { hasErrors, type FieldErrors } from '@fossil/shared';

/** The field errors an API 400 carried (`errors`, or `details` from the error handler), or null. */
export function serverFieldErrors(error: any): FieldErrors | null {
  const data = error?.response?.data;
  const map = data?.errors ?? data?.details;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  const out: FieldErrors = {};
  for (const [field, message] of Object.entries(map)) {
    if (typeof message === 'string' && message) out[field] = message;
  }
  return hasErrors(out) ? out : null;
}

function valuesKey(values: unknown): string {
  try {
    return JSON.stringify(values) ?? '';
  } catch {
    return '';
  }
}

/**
 * Runs a form's shared validator and keeps its messages.
 *
 * Nothing shows until the first save attempt. From then on the messages follow
 * the values, so a message goes away as soon as the field is fixed. Errors the
 * API sends back (a duplicate code, say) show too, until the form changes.
 *
 *   const form = useFormValidation(validateSite, values);
 *   const save = async () => {
 *     if (!form.check()) return;
 *     try { await api.save(values); } catch (error) { if (!form.fromServer(error)) showToast(...); }
 *   };
 *   <div ref={form.formRef}>
 *     <input {...form.invalid('name')} ... />
 *     <FieldError message={form.errors.name} />
 *   </div>
 *
 * Call `reset()` when the form is opened again or moves to another step.
 */
export function useFormValidation<T>(validate: (values: T) => FieldErrors, values: T) {
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const formRef = useRef<any>(null);

  const key = valuesKey(values);
  useEffect(() => {
    setServerErrors((previous) => (hasErrors(previous) ? {} : previous));
  }, [key]);

  const live = attempted ? validate(values) : {};
  const errors: FieldErrors = { ...serverErrors, ...live };

  const focusFirst = () => {
    setTimeout(() => {
      const root: ParentNode = formRef.current || document;
      const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!field) return;
      field.focus({ preventScroll: true });
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  };

  /** Validates now. False, with the first bad field focused, when something needs fixing. */
  const check = (override?: T): boolean => {
    setAttempted(true);
    setServerErrors({});
    const found = validate(override === undefined ? values : override);
    if (hasErrors(found)) {
      focusFirst();
      return false;
    }
    return true;
  };

  /** Forgets the messages, e.g. when the form is opened for another record. */
  const reset = () => {
    setAttempted(false);
    setServerErrors({});
  };

  /** Shows the field errors from a failed save. True when there were any. */
  const fromServer = (error: any): boolean => {
    const found = serverFieldErrors(error);
    if (!found) return false;
    setServerErrors(found);
    focusFirst();
    return true;
  };

  /** Spread onto an input: marks it red (see index.css) and tells screen readers. */
  const invalid = (field: string) => (errors[field] ? { 'aria-invalid': true as const } : {});

  return { errors, check, reset, fromServer, invalid, formRef, attempted };
}

/** The message under a field that failed its check. Renders nothing when there is none. */
export default function FieldError({ message, className = '' }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p aria-live="polite" className={`mt-1 text-xs text-red-600 ${className}`}>
      {message}
    </p>
  );
}

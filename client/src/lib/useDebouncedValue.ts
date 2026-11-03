import { useEffect, useState } from 'react';

/**
 * The value once it has stopped changing for `delay` ms. Search boxes bind the
 * input to the live value and fetch with this one, so typing "cement" sends one
 * request instead of six and the list doesn't flicker through each prefix.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function readStoredSession(): { token: string | null; user: any | null } {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  try {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      return { token: null, user: null };
    }

    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function persistSession(token: string, user: any): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function hasStoredSession(): boolean {
  return !!readStoredSession().token;
}

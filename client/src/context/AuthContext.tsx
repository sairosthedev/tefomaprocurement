import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../lib/api';
import {
  readStoredSession,
  persistSession,
  clearSession,
  hasStoredSession
} from '../lib/session';
import { logOtpToBrowserConsole } from '../lib/otpDebug';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(() => readStoredSession().user);
  const [loading, setLoading] = useState<any>(true);

  const hydrateFromStorage = useCallback(() => {
    const { user: storedUser } = readStoredSession();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { token, user: storedUser } = readStoredSession();

      if (storedUser) {
        setUser(storedUser);
      }

      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.user);
          persistSession(token, response.data.user);
        } catch {
          clearSession();
          setUser(null);
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: any, password: any) => {
    const response = await authAPI.login({ email, password });
    if (response.data.requiresOtp) {
      if (response.data.debugOtp) {
        logOtpToBrowserConsole(response.data.email || email, response.data.debugOtp);
      }
      return {
        requiresOtp: true,
        email: response.data.email,
        message: response.data.message,
        debugOtp: response.data.debugOtp
      };
    }

    const { token, user: sessionUser } = response.data;
    if (!token || !sessionUser) {
      throw new Error('Invalid login response');
    }

    persistSession(token, sessionUser);
    setUser(sessionUser);
    return { requiresOtp: false, user: sessionUser };
  };

  const verifyOtp = async (email: any, otp: any) => {
    const response = await authAPI.verifyOtp({ email, otp });
    const { token, user: sessionUser } = response.data;

    if (!token || !sessionUser) {
      throw new Error('Invalid verification response');
    }

    persistSession(token, sessionUser);
    setUser(sessionUser);
    hydrateFromStorage();
    return sessionUser;
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  const updateUser = (updatedData: any) => {
    const newUser: any = { ...user, ...updatedData };
    const { token } = readStoredSession();
    if (token) {
      persistSession(token, newUser);
    }
    setUser(newUser);
  };

  const value: any = {
    user,
    loading,
    login,
    verifyOtp,
    logout,
    updateUser,
    isAuthenticated: hasStoredSession()
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

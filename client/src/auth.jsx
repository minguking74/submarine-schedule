import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('auth_token');
    const name = localStorage.getItem('auth_name');
    const role = localStorage.getItem('auth_role');
    return token ? { token, name, role } : null;
  });

  useEffect(() => {
    function handleUnauthorized() {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_name');
      localStorage.removeItem('auth_role');
      setSession(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(name, password) {
    const res = await api.post('/auth/login', { name, password });
    localStorage.setItem('auth_token', res.token);
    localStorage.setItem('auth_name', res.name);
    localStorage.setItem('auth_role', res.role);
    setSession({ token: res.token, name: res.name, role: res.role });
  }

  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_name');
    localStorage.removeItem('auth_role');
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{
      token: session?.token || null,
      name: session?.name || null,
      role: session?.role || null,
      isAdmin: session?.role === 'admin',
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

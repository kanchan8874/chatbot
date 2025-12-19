"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token with backend
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.VERIFY_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      // Check if response is ok
      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      
      if (data.valid) {
        setUser(data.user);
      } else {
        // Invalid token, remove it
        localStorage.removeItem('token');
      }
    } catch (error) {
      // Silently handle errors - backend might not be running
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Token verification failed (backend may not be running):', error.message);
      }
      // Don't remove token if it's just a network error
      // Only remove if it's an actual invalid token response
      if (error.message !== 'Failed to fetch' && error.message !== 'NetworkError') {
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Save token to localStorage
        localStorage.setItem('token', data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const googleLogin = async (googleToken) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleToken }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Save token to localStorage
        localStorage.setItem('token', data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Google login failed:', error);
      return { success: false, message: 'Google login failed. Please try again.' };
    }
  };

  const logout = async () => {
    console.log('Logout function called');
    try {
      const token = localStorage.getItem('token');
      console.log('Token found:', !!token);
      
      // Call backend logout API
      if (token) {
        try {
          console.log('Calling logout API:', API_ENDPOINTS.AUTH.LOGOUT);
          const response = await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          console.log('Logout API response status:', response.status);
          
          if (!response.ok) {
            console.warn('Logout API returned non-OK status:', response.status);
          }
        } catch (apiError) {
          // Log but don't fail - we'll still logout locally
          console.warn('Backend logout API call failed, logging out locally:', apiError);
        }
      } else {
        console.log('No token found, logging out locally only');
      }
      
      // Always clear local state (synchronously)
      console.log('Clearing localStorage and user state...');
      localStorage.removeItem('token');
      setUser(null);
      
      console.log('Logout completed successfully');
      // Return success immediately
      return { success: true };
    } catch (error) {
      console.error('Logout failed with error:', error);
      
      // Even if there's an error, clear everything
      localStorage.removeItem('token');
      setUser(null);
      
      return { success: true, message: 'Logged out locally' };
    }
  };

  const value = {
    user,
    loading,
    login,
    googleLogin,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
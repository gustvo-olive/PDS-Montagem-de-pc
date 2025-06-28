
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { User } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  currentUser: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (nome: string, email: string, pass: string) => Promise<void>;
  updateUser: (updates: { nome?: string; email?: string; password?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nome, email')
      .eq('id', supabaseUser.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
      console.error("Error fetching user profile:", error);
      return null;
    }
    
    if (profile) {
      return { id: supabaseUser.id, nome: profile.nome, email: profile.email };
    }
    return null;

  }, []);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
       if (error) {
         console.error("Error getting initial session:", error);
         setIsLoading(false);
         return;
       }

      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setCurrentUser(profile);
      }
      setIsLoading(false);
    };
    
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setCurrentUser(profile);
      } else {
        setCurrentUser(null);
      }
       if (event === 'INITIAL_SESSION') {
        // already handled by getInitialSession
      } else {
         setIsLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const handleAuthSuccessNavigation = () => {
    const navState = location.state as any;
    const fromLocation = navState?.from;
    const originalPath = fromLocation?.pathname || '/dashboard';
    
    // Check for pending actions after login
    if (navState?.pendingAction) {
       navigate(originalPath, { replace: true, state: { fromLogin: true, action: navState.pendingAction } });
    } else {
       navigate(originalPath, { replace: true });
    }
  };

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    handleAuthSuccessNavigation();
  };

  const register = async (nome: string, email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          nome: nome, // This will be used by the trigger to create the profile
        },
      },
    });
    if (error) throw error;
    handleAuthSuccessNavigation();
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    sessionStorage.removeItem('proceededAnonymously');
    sessionStorage.removeItem('pendingBuild'); 
    sessionStorage.removeItem('pendingAiNotes');
    setCurrentUser(null);
    setSession(null);
    navigate('/');
  };

  const updateUser = async (updates: { nome?: string; email?: string; password?: string }) => {
    if (!currentUser || !session?.user) throw new Error("User not authenticated.");

    const { nome, email, password } = updates;
    const supabaseUserUpdates: any = {};
    if (email) supabaseUserUpdates.email = email;
    if (password) supabaseUserUpdates.password = password;

    // Update auth user if email or password changed
    if (Object.keys(supabaseUserUpdates).length > 0) {
      const { error: authError } = await supabase.auth.updateUser(supabaseUserUpdates);
      if (authError) throw authError;
    }
    
    // Update profiles table if name changed
    if (nome) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nome })
        .eq('id', currentUser.id);
      if (profileError) throw profileError;
    }
    
    // Refetch the user profile to update state
    const updatedProfile = await fetchUserProfile(session.user);
    setCurrentUser(updatedProfile);
  };

  const value: AuthContextType = {
    currentUser,
    session,
    isLoading,
    login,
    logout,
    register,
    updateUser
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

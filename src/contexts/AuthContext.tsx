import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Staff, StaffRole } from '@/types/database';

interface AuthContextType {
  user: { id: string; email: string } | null;
  staff: Staff | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
          
          // Fetch staff profile - use setTimeout to avoid blocking
          setTimeout(async () => {
            const { data: staffData } = await supabase
              .from('staff')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('status', 'active')
              .single();
            
            if (staffData) {
              setStaff(staffData as Staff);
            }
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setStaff(null);
          setIsLoading(false);
        }
      }
    );

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
        
        supabase
          .from('staff')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single()
          .then(({ data: staffData }) => {
            if (staffData) {
              setStaff(staffData as Staff);
            }
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return { error };
      }
      
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setStaff(null);
  };

  const hasRole = (roles: StaffRole[]) => {
    if (!staff) return false;
    return roles.includes(staff.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        isLoading,
        isAuthenticated: !!user && !!staff,
        signIn,
        signOut,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

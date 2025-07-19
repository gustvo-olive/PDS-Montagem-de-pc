/**
 * @file Contexto de Autenticação
 * @module contexts/AuthContext
 * @description
 * Este arquivo implementa o contexto de autenticação da aplicação usando React Context e Supabase.
 * Ele fornece um provedor (`AuthProvider`) que gerencia o estado do usuário (login, logout, sessão),
 * e um hook customizado (`useAuth`) para acessar facilmente esses dados em qualquer componente.
 */

// Importações necessárias do React, React Router e Supabase.
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { User } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Session, User as SupabaseUser, AuthChangeEvent } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

/**
 * @interface AuthContextType
 * @description Define a estrutura do objeto de contexto de autenticação,
 * incluindo o usuário atual, a sessão e as funções de autenticação.
 */
interface AuthContextType {
  /** O usuário logado, com nosso tipo `User`. Null se não estiver logado. */
  currentUser: User | null;
  /** A sessão do Supabase. Contém informações como token de acesso. Null se não houver sessão. */
  session: Session | null;
  /** `true` enquanto o estado inicial de autenticação está sendo carregado. */
  isLoading: boolean;
  /**
   * Realiza o login do usuário.
   * @param email - O email do usuário.
   * @param pass - A senha do usuário.
   * @returns Uma Promise resolvida em caso de sucesso ou rejeitada em caso de erro.
   */
  login: (email: string, pass: string) => Promise<void>;
  /**
   * Realiza o logout do usuário, encerrando a sessão.
   * @returns Uma Promise resolvida em caso de sucesso ou rejeitada em caso de erro.
   */
  logout: () => Promise<void>;
  /**
   * Registra um novo usuário.
   * @param nome - O nome do usuário.
   * @param email - O email para registro.
   * @param pass - A senha para o novo usuário.
   * @returns Uma Promise resolvida em caso de sucesso ou rejeitada em caso de erro.
   */
  register: (nome: string, email: string, pass: string) => Promise<void>;
  /**
   * Atualiza os dados do usuário logado (nome, email, senha).
   * @param updates - Um objeto contendo os campos a serem atualizados.
   * @returns Uma Promise resolvida em caso de sucesso ou rejeitada em caso de erro.
   */
  updateUser: (updates: { nome?: string; email?: string; password?: string }) => Promise<void>;
}

/**
 * Contexto de autenticação React.
 * @internal
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * @component AuthProvider
 * @description Componente provedor que encapsula toda a lógica de autenticação
 * e disponibiliza o `AuthContext` para os componentes filhos.
 * @param {{ children: ReactNode }} props - As propriedades do componente, que incluem os filhos a serem renderizados.
 * @returns {React.ReactElement} O provedor de contexto envolvendo os componentes filhos.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Busca o perfil do usuário na tabela 'profiles' do Supabase.
   * Inclui uma lógica de nova tentativa para lidar com o atraso entre a criação do usuário em 'auth.users'
   * e a criação do perfil pelo trigger do banco de dados.
   * @param {SupabaseUser} supabaseUser - O objeto de usuário do Supabase.
   * @returns {Promise<User | null>} O perfil do usuário formatado ou nulo se não encontrado.
   * @private
   */
  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    for (let i = 0; i < 3; i++) {
        // To work around the "Type instantiation is excessively deep" error, we avoid
        // direct destructuring. Instead, we assign the result to an `any` typed variable,
        // which is a more robust way to halt TypeScript's problematic deep type inference.
        const queryResponse: any = await supabase
            .from('profiles')
            .select('nome, email')
            .eq('id', supabaseUser.id)
            .single();
        
        const { data, error } = queryResponse;

        if (error && error.code !== 'PGRST116') { // 'PGRST116' é o erro para "nenhuma linha encontrada".
            console.error("Error fetching user profile:", error);
            return null;
        }
        if (data) {
            const profile = data as { nome: string; email: string };
            return { id: supabaseUser.id, nome: profile.nome, email: profile.email };
        }
        if (i < 2) { // Se não for a última tentativa, espera um pouco antes de tentar novamente.
             await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    console.error("Profile not found for user after retries:", supabaseUser.id);
    return null;
  }, []);

  // Efeito principal que gerencia o estado de autenticação de forma robusta.
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 1. Proativamente busca a sessão atual ao carregar.
        // Isso é mais rápido e confiável do que apenas esperar pelo onAuthStateChange.
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Erro ao buscar a sessão inicial:", error);
          // Mesmo com erro, consideramos o carregamento concluído.
          return; 
        }

        setSession(initialSession);
        if (initialSession?.user) {
          const profile = await fetchUserProfile(initialSession.user);
          setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
      } catch (e) {
        console.error("Erro inesperado na inicialização da autenticação:", e);
      } finally {
        // 3. Garante que o estado de carregamento seja finalizado.
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    initializeAuth();

    // 2. Ouve por mudanças futuras (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        setCurrentUser(profile);
      } else {
        setCurrentUser(null);
      }
      // Não é mais necessário controlar o isLoading aqui, pois o estado inicial já foi resolvido.
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);


  // Efeito para lidar com o redirecionamento após um login ou registro bem-sucedido.
  useEffect(() => {
    if (currentUser && justAuthenticated) {
      setJustAuthenticated(false); 

      const navState = location.state as any;
      const fromLocation = navState?.from;
      const originalPath = fromLocation?.pathname || '/dashboard';
      
      if (navState?.pendingAction) {
         navigate(originalPath, { replace: true, state: { fromLogin: true, action: navState.pendingAction } });
      } else {
         navigate(originalPath, { replace: true });
      }
    }
  }, [currentUser, justAuthenticated, location, navigate]);


  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    if (data.session) {
      setJustAuthenticated(true);
    }
  };

  const register = async (nome: string, email: string, pass: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { nome: nome },
      },
    });
    if (error) throw error;
    
    if (data.session) {
      setJustAuthenticated(true);
      toast.success('Cadastro realizado com sucesso! Bem-vindo(a)!');
    } else if (data.user) {
      toast.success('Cadastro realizado! Verifique seu e-mail para confirmar a conta.', {
        duration: 6000,
      });
      navigate('/login');
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    sessionStorage.removeItem('proceededAnonymously');
    sessionStorage.removeItem('pendingBuild'); 
    sessionStorage.removeItem('pendingAiNotes');
    navigate('/');
  };

  const updateUser = async (updates: { nome?: string; email?: string; password?: string }) => {
    if (!currentUser || !session?.user) throw new Error("User not authenticated.");

    const { nome, email, password } = updates;
    const supabaseUserUpdates: any = {};
    if (email) supabaseUserUpdates.email = email;
    if (password) supabaseUserUpdates.password = password;
    
    if (Object.keys(supabaseUserUpdates).length > 0) {
      const { data, error: authError } = await supabase.auth.updateUser(supabaseUserUpdates);
      if (authError) throw authError;
      if(data.user) {
          const updatedProfile = await fetchUserProfile(data.user);
          setCurrentUser(updatedProfile);
      }
    }
    
    if (nome && nome !== currentUser.nome) {
      // The `never` type error on `update` suggests a deep type inference failure.
      // Simplifying the call by passing the update object directly helps avoid the issue.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nome })
        .eq('id', currentUser.id);
      if (profileError) throw profileError;
      setCurrentUser(prev => prev ? { ...prev, nome } : null);
    }
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

/**
 * @hook useAuth
 * @description Hook customizado para consumir o `AuthContext` de forma fácil e segura.
 * Ele garante que o hook seja usado dentro de um `AuthProvider`.
 * @returns {AuthContextType} O objeto de valor do contexto de autenticação.
 * @throws {Error} Se usado fora de um `AuthProvider`.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
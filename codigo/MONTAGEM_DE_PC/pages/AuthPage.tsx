/**
 * @file Página de Autenticação (AuthPage).
 * @module pages/AuthPage
 * @description Este componente renderiza um formulário unificado para login e registro de usuários.
 * O modo de operação ('login' ou 'register') é determinado por uma propriedade.
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/core/Button';
import LoadingSpinner from '../components/core/LoadingSpinner';

/**
 * @interface AuthPageProps
 * @description Propriedades para o componente AuthPage.
 */
interface AuthPageProps {
  /**
   * Determina se a página está em modo de login ou registro.
   */
  mode: 'login' | 'register';
}

/**
 * @component AuthPage
 * @description Um componente de página que fornece uma UI para os usuários se autenticarem
 * (login) ou criarem uma nova conta (registro). Ele utiliza o `AuthContext` para
 * executar as operações de autenticação e lida com o estado do formulário e feedback de erro.
 * @param {AuthPageProps} props - As propriedades do componente, definindo o modo ('login' ou 'register').
 * @returns {React.ReactElement} A página com o formulário de autenticação.
 */
const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { login, register, isLoading } = useAuth();
  const location = useLocation(); 

  /**
   * Manipula o envio do formulário de autenticação.
   * Chama a função `login` ou `register` do `AuthContext` com base no modo da página.
   * @param {React.FormEvent} e - O evento de envio do formulário.
   * @private
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      try {
        await register(nome, email, password);
      } catch (err: any) {
        setError(err.message || 'Falha ao registrar. Tente novamente.');
      }
    } else {
      try {
        await login(email, password);
      } catch (err: any) {
        setError(err.message || 'Falha ao fazer login. Verifique suas credenciais.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-secondary p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-accent">
            {mode === 'login' ? 'Acessar sua Conta' : 'Criar Nova Conta'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <p className="text-center text-sm text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
          
          {mode === 'register' && (
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="nome" className="sr-only">Nome</label> 
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-neutral-dark bg-primary placeholder-neutral-dark text-neutral rounded-t-md focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
                  placeholder="Nome Completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-3 border border-neutral-dark bg-primary placeholder-neutral-dark text-neutral ${mode === 'login' ? 'rounded-t-md' : ''} focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm`}
                placeholder="Endereço de Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password_login" className="sr-only">Senha</label>
              <input
                id="password_login"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? "current-password" : "new-password"}
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-3 border border-neutral-dark bg-primary placeholder-neutral-dark text-neutral ${mode === 'login' ? 'rounded-b-md' : ''} ${mode === 'register' ? 'border-t-0' : ''} focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm`}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {mode === 'register' && (
             <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="confirm-password" className="sr-only">Confirmar Senha</label>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-3 border border-neutral-dark bg-primary placeholder-neutral-dark text-neutral rounded-b-md border-t-0 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm"
                    placeholder="Confirmar Senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
          )}


          <div>
            <Button type="submit" className="w-full" variant="primary" size="lg" isLoading={isLoading}>
              {isLoading ? <LoadingSpinner size="sm" /> : (mode === 'login' ? 'Entrar' : 'Registrar')}
            </Button>
          </div>
        </form>

        <div className="text-sm text-center">
          {mode === 'login' ? (
            <p className="text-neutral-dark">
              Não tem uma conta?{' '}
              <Link to="/register" state={location.state} className="font-medium text-accent hover:text-opacity-80">
                Cadastre-se
              </Link>
            </p>
          ) : (
            <p className="text-neutral-dark">
              Já tem uma conta?{' '}
              <Link to="/login" state={location.state} className="font-medium text-accent hover:text-opacity-80">
                Faça login
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
/**
 * @file Componente principal da aplicação e configuração de rotas.
 * @module App
 * @description
 * Este arquivo define a estrutura de roteamento da aplicação usando `react-router-dom`.
 * Ele envolve todas as páginas com os provedores de contexto necessários (`AuthProvider`)
 * e o layout visual padrão (`Layout`). Também implementa a lógica para rotas protegidas
 * que exigem autenticação.
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import { BuildPage } from './pages/BuildPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/core/LoadingSpinner';

/**
 * @component ProtectedRoute
 * @description Um componente de wrapper que protege rotas, permitindo o acesso apenas
 * a usuários autenticados. Se o usuário não estiver logado, ele é redirecionado
 * para a página de login, salvando a localização original para redirecionamento futuro.
 * @returns {React.ReactElement} O componente `Outlet` para renderizar a rota filha se o usuário estiver autenticado, ou um componente `Navigate` para redirecionar.
 */
const ProtectedRoute: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner size="lg" text="Verificando autenticação..." /></div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <Outlet />;
};


/**
 * @component App
 * @description O componente raiz da aplicação que configura todas as rotas.
 * Ele utiliza `HashRouter` para compatibilidade com hospedagem estática e
 * define quais páginas são públicas e quais são protegidas.
 * @returns {React.ReactElement} A aplicação completa com roteamento e provedores de contexto.
 */
const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* --- Rotas Públicas --- */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            
            {/* A rota de montagem é pública para permitir o uso anônimo. */}
            <Route path="/build" element={<BuildPage />} />
            <Route path="/build/:buildId" element={<BuildPage />} />

            {/* --- Rotas Protegidas --- */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            
            {/* Rota de fallback para 404 */}
            <Route path="*" element={
              <div className="text-center py-10">
                <h1 className="text-4xl font-bold text-accent mb-4">404 - Página Não Encontrada</h1>
                <p className="text-neutral-dark">Desculpe, a página que você está procurando não existe.</p>
                <Link to="/" className="mt-6 inline-block px-6 py-2 text-sm font-medium text-primary bg-accent rounded hover:bg-opacity-80 transition">
                  Voltar para Home
                </Link>
              </div>
            } />
          </Routes>
        </Layout>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
/**
 * @file Componente Navbar.
 * @module components/layout/Navbar
 * @description Barra de navegação superior da aplicação, que exibe links diferentes
 * com base no estado de autenticação do usuário.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../core/Button';

/**
 * @component Navbar
 * @description Componente da barra de navegação superior. Ele consome o `AuthContext`
 * para exibir dinamicamente links de navegação para usuários logados (Painel, Sair)
 * ou para visitantes (Login, Cadastrar).
 * @returns {React.ReactElement} O elemento da barra de navegação.
 */
const Navbar: React.FC = () => {
  const { currentUser, logout, isLoading } = useAuth();
  const navigate = useNavigate();

  /**
   * Manipula o evento de clique no botão de logout.
   * @private
   */
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-secondary shadow-lg sticky top-0 z-40">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-accent hover:text-opacity-80 transition-colors">
          CodeTugaBuilds
        </Link>
        <div className="flex items-center space-x-4">
          {isLoading ? (
            <span className="text-neutral-dark">Carregando...</span>
          ) : currentUser ? (
            <>
              <Link to="/dashboard" className="text-neutral hover:text-accent transition-colors px-3 py-2 rounded-md text-sm font-medium">
                Painel
              </Link>
              <Link to="/build" state={{ newBuild: true }} className="text-neutral hover:text-accent transition-colors px-3 py-2 rounded-md text-sm font-medium">
                Nova Montagem
              </Link>
              <span className="text-neutral-dark text-sm hidden md:block">Olá, {currentUser.nome}!</span>
              <Button onClick={handleLogout} variant="ghost" size="sm">
                Sair
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-neutral hover:text-accent transition-colors px-3 py-2 rounded-md text-sm font-medium">
                Login
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Cadastrar
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
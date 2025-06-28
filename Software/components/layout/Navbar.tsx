
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../core/Button';

const Navbar: React.FC = () => {
  const { currentUser, logout, isLoading } = useAuth();
  const navigate = useNavigate();

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
              <span className="text-neutral-dark text-sm hidden md:block">Olá, {currentUser.nome}!</span> {/* Alterado para currentUser.nome */}
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

/**
 * @file Componente de Layout principal.
 * @module components/layout/Layout
 * @description Fornece a estrutura visual base para todas as páginas da aplicação,
 * incluindo a barra de navegação, o rodapé e um contêiner para o conteúdo principal.
 */

import React, { ReactNode } from 'react';
import Navbar from './Navbar';
import { Toaster } from 'react-hot-toast';

/**
 * @interface LayoutProps
 * @description Propriedades para o componente Layout.
 */
interface LayoutProps {
  /**
   * O conteúdo da página a ser renderizado dentro do layout.
   */
  children: ReactNode;
}

/**
 * @component Footer
 * @description O componente do rodapé da aplicação.
 * @private
 * @returns {React.ReactElement} O elemento do rodapé.
 */
const Footer: React.FC = () => {
  return (
    <footer className="bg-secondary text-neutral-dark py-8 mt-auto">
      <div className="container mx-auto px-6 text-center">
        <p>&copy; {new Date().getFullYear()} CodeTugaBuilds. Todos os direitos reservados.</p>
        <p className="text-sm mt-1">Montador de PCs Inteligente</p>
      </div>
    </footer>
  );
};


/**
 * @component Layout
 * @description Componente principal que envolve todas as páginas, fornecendo uma
 * estrutura consistente com uma barra de navegação (`Navbar`) no topo, um rodapé (`Footer`)
 * na parte inferior, e um sistema de notificações (`Toaster`).
 * @param {LayoutProps} props - As propriedades do componente, que incluem os `children` a serem renderizados.
 * @returns {React.ReactElement} O elemento do layout envolvendo o conteúdo da página.
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-primary text-neutral">
      <Toaster 
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            margin: '8px',
            background: '#1B263B', // secondary color
            color: '#E0E1DD', // neutral color
            border: '1px solid #778DA9', // neutral-dark
          },
          success: {
            iconTheme: {
              primary: '#41EAD4', // accent color
              secondary: '#0D1B2A', // primary color
            },
          },
           error: {
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#E0E1DD', // neutral color
            },
          },
        }}
      />
      <Navbar />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
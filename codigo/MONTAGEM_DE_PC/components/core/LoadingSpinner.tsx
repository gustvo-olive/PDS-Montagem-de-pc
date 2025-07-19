/**
 * @file Componente LoadingSpinner.
 * @module components/core/LoadingSpinner
 * @description Componente de UI reutilizável para exibir um ícone de carregamento (spinner),
 * com opções de tamanho e texto.
 */

import React from 'react';

/**
 * @interface LoadingSpinnerProps
 * @description Propriedades para o componente LoadingSpinner.
 */
interface LoadingSpinnerProps {
  /**
   * O tamanho do spinner.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * A classe de cor do Tailwind CSS para o spinner (ex: 'text-accent').
   * @default 'text-accent'
   */
  color?: string;
  /**
   * Texto opcional a ser exibido abaixo do spinner.
   */
  text?: string;
}

/**
 * @component LoadingSpinner
 * @description Um componente funcional para exibir um ícone de carregamento animado.
 * Ideal para indicar operações em andamento.
 * @param {LoadingSpinnerProps} props - As propriedades para configurar o spinner, como `size`, `color` e `text`.
 * @returns {React.ReactElement} O elemento do spinner de carregamento.
 * @example
 * ```tsx
 * <LoadingSpinner size="lg" text="Carregando dados..." />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', color = 'text-accent', text }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${color} border-t-transparent`}
        style={{ borderTopColor: 'transparent' }}
        role="status"
        aria-live="polite"
      >
         <span className="sr-only">Carregando...</span>
      </div>
      {text && <p className={`text-sm ${color}`}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
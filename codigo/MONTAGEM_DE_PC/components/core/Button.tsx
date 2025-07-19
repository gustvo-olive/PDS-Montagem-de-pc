/**
 * @file Componente Button.
 * @module components/core/Button
 * @description Um componente de botão altamente reutilizável com variantes de estilo,
 * tamanhos, estado de carregamento e suporte a ícones.
 */

import React from 'react';

/**
 * @interface ButtonProps
 * @description Propriedades para o componente Button. Estende as propriedades padrão de um botão HTML.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Estilos visuais do botão.
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /**
   * Tamanho do botão.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Se `true`, exibe um spinner de carregamento e desabilita o botão.
   * @default false
   */
  isLoading?: boolean;
  /**
   * Ícone React a ser exibido à esquerda do texto do botão.
   */
  leftIcon?: React.ReactNode;
  /**
   * Ícone React a ser exibido à direita do texto do botão.
   */
  rightIcon?: React.ReactNode;
}

/**
 * @component Button
 * @description Um componente de botão versátil que encapsula estilos e comportamentos comuns,
 * como estados de carregamento e variantes visuais.
 * @param {ButtonProps} props - Propriedades para configurar o botão, incluindo `variant`, `size`, `isLoading`, ícones e outras propriedades HTML de botão.
 * @returns {React.ReactElement} O elemento do botão.
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="lg"
 *   isLoading={isSubmitting}
 *   onClick={handleSubmit}
 *   leftIcon={<CheckIcon />}
 * >
 *   Confirmar
 * </Button>
 * ```
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary transition-colors duration-150 flex items-center justify-center';

  const variantStyles = {
    primary: 'bg-accent text-primary hover:bg-opacity-80 focus:ring-accent',
    secondary: 'bg-secondary text-neutral hover:bg-opacity-80 focus:ring-neutral-dark',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-accent hover:bg-accent hover:text-primary focus:ring-accent',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const loadingSpinner = (
    <svg className="animate-spin h-5 w-5 text-currentColor" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${isLoading || disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? loadingSpinner : (
        <>
          {leftIcon && <span className="mr-2">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
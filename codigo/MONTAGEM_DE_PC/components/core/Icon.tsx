/**
 * @file Componente Icon.
 * @module components/core/Icon
 * @description Um componente que renderiza um ícone SVG específico com base em uma
 * string de categoria de componente de hardware.
 */

import React from 'react';

/**
 * @interface IconProps
 * @description Propriedades para o componente Icon.
 */
interface IconProps {
  /**
   * A categoria do componente (ex: "Processadores", "Placas de Vídeo")
   * que determina qual ícone será renderizado.
   */
  category: string;
  /**
   * Classes CSS adicionais para aplicar ao elemento SVG, permitindo
   * estilização customizada (ex: tamanho, cor).
   */
  className?: string;
}

/**
 * @component Icon
 * @description Um componente funcional que seleciona e renderiza um ícone SVG
 * de uma coleção pré-definida, com base na `category` fornecida.
 * Útil para representar visualmente diferentes tipos de componentes de hardware.
 * @param {IconProps} props - Propriedades para configurar o ícone, incluindo `category` e `className`.
 * @returns {React.ReactElement} O elemento SVG do ícone correspondente.
 * @example
 * ```tsx
 * <Icon category="Processadores" className="w-8 h-8 text-blue-500" />
 * ```
 */
const Icon: React.FC<IconProps> = ({ category, className = '' }) => {
  /**
   * Retorna o elemento SVG apropriado com base na string da categoria.
   * @returns {React.ReactElement} O ícone SVG.
   * @private
   */
  const getIcon = () => {
    switch (category) {
      case 'Processadores': // CPU
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5M15.75 21v-1.5M12 4.5v-1.5m0 18v-1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5v15h15V4.5h-15z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" />
          </svg>
        );
      case 'Placas-Mãe': // Motherboard
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125H9m-6.75 5.625v-5.625m16.5 5.625V10.5M3 15.75h9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15.75H9v-9h6v9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 15.75h2.25M17.25 12h2.25m-2.25-3.75h2.25M9 15.75v2.25m3-2.25v2.25m3-2.25v2.25m3-5.625h-3m-3-3.375v-2.25m3 2.25v-2.25m3 2.25v-2.25" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3.75h18v16.5H3v-16.5z" />
          </svg>
        );
      case 'Memória RAM': // RAM
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6h19.5M2.25 18h19.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6v12M19.5 6v12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 9h1.5m3 0h1.5m3 0h1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.625 18.375a.375.375 0 10-.75 0 .375.375 0 00.75 0z" />
          </svg>
        );
      case 'Placas de Vídeo': // GPU
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 10.5h18" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 10.5V18h13.5V10.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 14.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 14.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5v1.5a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-1.5" />
          </svg>
        );
      case 'SSD':
        return (
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 17.25h15V5.25h-15v12z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h1.5M12 7.5h1.5M15 7.5h1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 14.25h1.5m3 0h1.5" />
          </svg>
        );
      case 'Armazenamento':
      case 'HD':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-10.5l-3-3h-12l-3 3v10.5h18z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 10-7.5 0 3.75 3.75 0 007.5 0z" />
          </svg>
        );
      case 'Fonte': // PSU
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v-6H3v6h18z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 12a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M18 12h-1.5m-9 0H6" />
          </svg>
        );
      case 'Gabinete': // Case
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3h10.5v18H6.75z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 7.5h4.5m-4.5 4.5h4.5M9.75 16.5h1.5" />
          </svg>
        );
      case 'Cooler': // Cooler Fan
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v3m0 10.5v3M3.75 12h3m10.5 0h3M6.375 6.375l2.122 2.122m9.006 9.006l-2.122-2.122m-9.006 0l2.122-2.122m9.006-9.006l-2.122 2.122" />
          </svg>
        );
      default: // Ícone de fallback
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        );
    }
  };

  return <>{getIcon()}</>;
};

export default Icon;
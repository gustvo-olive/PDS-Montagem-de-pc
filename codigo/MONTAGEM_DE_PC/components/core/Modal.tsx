/**
 * @file Componente Modal.
 * @module components/core/Modal
 * @description Um componente de modal genérico e acessível para exibir conteúdo
 * sobreposto à página principal.
 */

import React, { ReactNode } from 'react';

/**
 * @interface ModalProps
 * @description Propriedades para o componente Modal.
 */
interface ModalProps {
  /**
   * Controla se o modal está visível ou não.
   */
  isOpen: boolean;
  /**
   * Função chamada quando o modal deve ser fechado (ex: clique no backdrop ou no botão de fechar).
   */
  onClose: () => void;
  /**
   * Título opcional para o modal, exibido no cabeçalho.
   */
  title?: string;
  /**
   * Conteúdo a ser renderizado dentro do modal.
   */
  children: ReactNode;
  /**
   * O tamanho do modal, controlando sua largura máxima.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * @component Modal
 * @description Um componente reutilizável para criar caixas de diálogo (modais).
 * Inclui um backdrop, tratamento de fechamento e suporte para tamanhos diferentes.
 * @param {ModalProps} props - As propriedades para controlar o modal, como `isOpen`, `onClose`, `title` e `children`.
 * @returns {React.ReactElement | null} O elemento do modal se `isOpen` for verdadeiro, senão nulo.
 * @example
 * ```tsx
 * const [isModalOpen, setIsModalOpen] = useState(false);
 *
 * <Modal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   title="Título do Modal"
 * >
 *   <p>Conteúdo do modal aqui.</p>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full h-full',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className={`bg-secondary p-6 rounded-lg shadow-xl transform transition-all duration-300 ease-in-out w-11/12 ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h2 id="modal-title" className="text-2xl font-semibold text-accent">{title}</h2>
            <button
              onClick={onClose}
              className="text-neutral-dark hover:text-accent transition-colors"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
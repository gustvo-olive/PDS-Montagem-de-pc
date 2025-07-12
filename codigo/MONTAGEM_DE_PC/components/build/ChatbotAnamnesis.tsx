/**
 * @file Componente ChatbotAnamnesis.
 * @module components/build/ChatbotAnamnesis
 * @description Este componente implementa a interface de chat interativa onde o usuário
 * conversa com a IA para definir os requisitos de sua build de PC. Ele gerencia o
 * fluxo da conversa, as chamadas para a API Gemini e as interações de UI, como pedir
 * permissão de localização.
 */

// Importações de React, tipos, serviços e componentes de UI.
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import Button from '../core/Button';
import LoadingSpinner from '../core/LoadingSpinner';

/**
 * @interface ChatbotAnamnesisProps
 * @description Propriedades para o componente ChatbotAnamnesis.
 */
interface ChatbotAnamnesisProps {
  messages: ChatMessage[];
  onSendMessage: (input: string) => void;
  isLoading: boolean;

  // Props para o fluxo de permissão de localização
  isAwaitingLocationPermission: boolean;
  onAllowLocation: () => void;
  onDenyLocation: () => void;
}

/**
 * @component ChatbotAnamnesis
 * @description O coração da interação com o usuário. Este componente gerencia
 * o estado do chat, envia as entradas do usuário para o `geminiService`, processa as
 * respostas da IA e atualiza a build em tempo real através do callback `onBuildUpdate`.
 * @param {ChatbotAnamnesisProps} props - Propriedades para inicializar o chatbot, incluindo `onBuildUpdate`, `availableComponents`, e dados iniciais.
 * @returns {React.ReactElement} A interface de chat interativa.
 */
const ChatbotAnamnesis: React.FC<ChatbotAnamnesisProps> = ({
  messages,
  onSendMessage,
  isLoading,
  isAwaitingLocationPermission,
  onAllowLocation,
  onDenyLocation,
}) => {
  const [userInput, setUserInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);
  
  // Efeito para focar no campo de input quando não há carregamento ou espera.
  useEffect(() => {
    if (!isLoading && !isAwaitingLocationPermission) {
        inputRef.current?.focus();
    }
  }, [isLoading, isAwaitingLocationPermission]);

  /**
   * Manipula o envio do formulário de mensagem do usuário.
   * @private
   */
  const handleSendMessage = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isLoading || isAwaitingLocationPermission) return;
    onSendMessage(userInput);
    setUserInput('');
  };
  
  return (
    <div className="bg-secondary p-4 sm:p-6 rounded-lg shadow-xl h-full flex flex-col">
      <h2 className="text-2xl font-semibold text-accent mb-4 text-center">Converse Comigo para Montar seu PC</h2>
      <div className="flex-grow h-96 overflow-y-auto p-4 border border-neutral-dark rounded-md mb-4 bg-primary space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow ${
                msg.sender === 'user' ? 'bg-accent text-primary' : 
                msg.sender === 'ai' ? 'bg-neutral-dark text-neutral' : 
                'bg-yellow-500/80 text-black text-sm italic text-center w-full' 
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
             <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow bg-neutral-dark text-neutral">
                    <LoadingSpinner size="sm" text="Pensando..." />
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {isAwaitingLocationPermission ? (
        <div className="my-2 p-4 border border-accent rounded-md bg-primary">
            <p className="text-neutral mb-3 text-center text-sm">A IA está pedindo sua localização para otimizar a refrigeração.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={onAllowLocation} variant="primary" isLoading={isLoading} className="flex-1">
              Permitir Detecção Automática
            </Button>
            <Button onClick={onDenyLocation} variant="secondary" isLoading={isLoading} className="flex-1">
              Não Permitir / Informar Manualmente
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={isLoading ? "Aguarde a resposta da IA..." : "Responda aqui ou peça uma alteração..."}
            className="flex-grow p-3 bg-primary border border-neutral-dark rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none text-neutral placeholder-neutral-dark"
            disabled={isLoading}
            aria-label="Sua mensagem para o chatbot"
          />
          <Button type="submit" isLoading={isLoading} disabled={!userInput.trim() || isLoading}>
            Enviar
          </Button>
        </form>
      )}
    </div>
  );
};

export default ChatbotAnamnesis;

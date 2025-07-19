/**
 * @file Componente ChatbotAnamnesis.
 * @module components/build/ChatbotAnamnesis
 * @description Este componente implementa a interface de chat interativa onde o usuário
 * conversa com a IA para definir os requisitos de sua build de PC. Ele gerencia o
 * fluxo da conversa, as chamadas para a API Gemini e as interações de UI, como pedir
 * permissão de localização.
 */

// Importações de React, tipos, serviços e componentes de UI.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PreferenciaUsuarioInput, ChatMessage, Build, Componente, Ambiente, PerfilPCDetalhado } from '../../types';
import { getLiveBuildResponse } from '../../services/geminiService';
import { getUserLocation, GeoLocation } from '../../services/geoService';
import { getCityWeather } from '../../services/weatherService';
import Button from '../core/Button';
import LoadingSpinner from '../core/LoadingSpinner';

/**
 * @interface ChatbotAnamnesisProps
 * @description Propriedades para o componente ChatbotAnamnesis.
 */
interface ChatbotAnamnesisProps {
  /**
   * Callback acionada a cada atualização da IA com novos dados para a build.
   * @param buildUpdate - Um objeto parcial da build com os dados atualizados.
   * @param finalPreferences - O objeto de preferências do usuário atualizado.
   */
  onBuildUpdate: (buildUpdate: Partial<Build>, finalPreferences: PreferenciaUsuarioInput) => void;
  /**
   * A lista de todos os componentes de hardware disponíveis para a IA escolher.
   */
  availableComponents: Componente[] | null;
  /**
   * Dados de anamnese iniciais, caso o usuário esteja continuando uma build.
   */
  initialAnamnesisData?: PreferenciaUsuarioInput;
}

/**
 * @component ChatbotAnamnesis
 * @description O coração da interação com o usuário. Este componente gerencia
 * o estado do chat, envia as entradas do usuário para o `geminiService`, processa as
 * respostas da IA e atualiza a build em tempo real através do callback `onBuildUpdate`.
 * @param {ChatbotAnamnesisProps} props - Propriedades para inicializar o chatbot, incluindo `onBuildUpdate`, `availableComponents`, e dados iniciais.
 * @returns {React.ReactElement} A interface de chat interativa.
 */
const ChatbotAnamnesis: React.FC<ChatbotAnamnesisProps> = ({ onBuildUpdate, availableComponents, initialAnamnesisData }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput>(
    initialAnamnesisData || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }
  );
  const initialMessagesSent = useRef(false);
  const [awaitingLocationPermission, setAwaitingLocationPermission] = useState<boolean>(false);
  const [locationProcessed, setLocationProcessed] = useState<boolean>(!!initialAnamnesisData?.ambiente?.cidade);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);
  
  /**
   * Adiciona uma nova mensagem à lista de mensagens do chat.
   * @param sender - Quem enviou a mensagem ('user', 'ai', 'system').
   * @param text - O conteúdo da mensagem.
   * @private
   */
  const addMessage = useCallback((sender: 'user' | 'ai' | 'system', text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, text, timestamp: Date.now() }]);
  }, []);

  /**
   * Função central que chama o serviço da IA para obter a próxima resposta e a build atualizada.
   * @param input - A entrada a ser enviada para a IA (geralmente a mensagem do usuário).
   * @param currentData - O estado atual das preferências do usuário.
   * @private
   */
  const callLiveBuilder = useCallback(async (input: string, currentData: PreferenciaUsuarioInput) => {
    if (!availableComponents) {
        addMessage('system', 'Erro: A lista de componentes não está disponível.');
        return;
    }
    setIsLoading(true);
    try {
      const response = await getLiveBuildResponse(messagesRef.current, input, currentData, availableComponents);
      if (response) {
          addMessage('ai', response.aiResponseText);
          setPreferencias(response.updatedPreferencias);

          if (response.actionRequired === 'request_location_permission' && !locationProcessed) {
            setAwaitingLocationPermission(true);
          }
          
          const componentMap = new Map(availableComponents.map(c => [c.id, c]));
          const recommendedComponents = (response.recommendedComponentIds || [])
              .map(id => componentMap.get(id))
              .filter((c): c is Componente => Boolean(c));
          
          const totalPrice = response.estimatedTotalPrice ?? recommendedComponents.reduce((sum, component) => sum + (component.Preco || 0), 0);

          const buildUpdate: Partial<Build> = {
              nome: `Build para ${response.updatedPreferencias.perfilPC.purpose || 'Uso Geral'}`,
              componentes: recommendedComponents,
              orcamento: totalPrice,
              justificativa: response.justification || undefined,
          };
          
          onBuildUpdate(buildUpdate, response.updatedPreferencias);
      } else {
         addMessage('system', 'A IA não retornou uma resposta válida. Tente novamente.');
      }
    } catch (error: any) {
      console.error("Error in chat:", error);
      addMessage('system', error.message || 'Desculpe, ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, availableComponents, onBuildUpdate, locationProcessed]);


  // Efeito para iniciar a conversa quando o componente é montado.
  useEffect(() => {
    if (initialMessagesSent.current) return;
    if (messages.length === 0 && (!initialAnamnesisData || Object.keys(initialAnamnesisData).length <= 2)) {
       addMessage('ai', "Olá! Sou o CodeTuga, seu assistente especializado. Vou fazer algumas perguntas para entender o que você precisa. Conforme conversamos, montarei seu PC em tempo real. Vamos começar!");
       const timeoutId = setTimeout(() => {
           callLiveBuilder('INICIAR_CONVERSA', preferencias);
       }, 500);
       initialMessagesSent.current = true;
       return () => clearTimeout(timeoutId);
    }
  }, [addMessage, initialAnamnesisData, messages.length, callLiveBuilder, preferencias]);

  /**
   * Manipula o envio do formulário de mensagem do usuário.
   * @private
   */
  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isLoading || awaitingLocationPermission) return;

    const userMsgText = userInput;
    addMessage('user', userMsgText);
    setUserInput('');
    await callLiveBuilder(userMsgText, preferencias);
  };
  
  // Efeito para focar no campo de input quando não há carregamento ou espera.
  useEffect(() => {
    if (!isLoading && !awaitingLocationPermission) {
        inputRef.current?.focus();
    }
  }, [isLoading, awaitingLocationPermission]);

  /**
   * Lida com a permissão de geolocalização automática pelo usuário.
   * @private
   */
  const handleAutoLocation = async () => {
    setAwaitingLocationPermission(false);
    setLocationProcessed(true);
    let systemMessageForGemini = "";
    let currentPrefs = JSON.parse(JSON.stringify(preferencias)) as PreferenciaUsuarioInput;
    if (!currentPrefs.ambiente) currentPrefs.ambiente = {} as Ambiente;

    addMessage('system', 'Você permitiu a detecção. Tentando obter sua localização e dados climáticos anuais (isso pode levar um momento)...');
    setIsLoading(true); 
    try {
      const loc: GeoLocation | null = await getUserLocation();
      if (loc && loc.city) {
        currentPrefs.ambiente.cidade = loc.city;
        currentPrefs.ambiente.codigoPais = loc.country_code3;
        
        const locationMsg = `Localização detectada: ${loc.city}, ${loc.country_code3}.`;
        addMessage('system', locationMsg);

        const weather = await getCityWeather(loc.latitude, loc.longitude);
        if (weather) {
          currentPrefs.ambiente.temperaturaMediaAnual = weather.avgTemp;
          currentPrefs.ambiente.temperaturaMaximaAnual = weather.maxTemp;
          currentPrefs.ambiente.temperaturaMinimaAnual = weather.minTemp;
          
          const weatherMsg = `Clima em ${loc.city}: Temp. Média Anual: ${weather.avgTemp}°C, Máx. Anual: ${weather.maxTemp}°C, Mín. Anual: ${weather.minTemp}°C.`;
          addMessage('system', weatherMsg);
          
          systemMessageForGemini = `Informação do sistema: O usuário permitiu a detecção de localização. Os dados de clima foram coletados (${locationMsg} ${weatherMsg}). Por favor, prossiga para a próxima pergunta lógica.`;
        } else {
          addMessage('system', 'Não foi possível obter os dados climáticos para sua região.');
          systemMessageForGemini = `Informação do sistema: Localização detectada como ${loc.city}, mas não foi possível obter dados climáticos. Prossiga para a próxima pergunta.`;
        }
        await callLiveBuilder(systemMessageForGemini, currentPrefs);
      } else {
        addMessage('system', 'Não foi possível detectar sua localização automaticamente.');
        addMessage('ai', 'Não consegui detectar sua localização. Por favor, para otimizar a refrigeração, me diga em qual cidade e estado você mora (ex: "São Paulo, SP").');
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error getting location/weather:", error);
      addMessage('system', 'Ocorreu um erro ao tentar obter sua localização ou clima.');
      addMessage('ai', 'Ocorreu um erro técnico. Por favor, para otimizar a refrigeração, me diga em qual cidade e estado você mora (ex: "São Paulo, SP").');
      setIsLoading(false);
    }
  };

  /**
   * Lida com a recusa do usuário em fornecer a localização automaticamente.
   * @private
   */
  const handleManualLocationPrompt = () => {
    setAwaitingLocationPermission(false);
    setLocationProcessed(true);
    addMessage('system', 'Usuário não permitiu detecção automática.');
    addMessage('ai', 'Tudo bem. Para otimizar a refrigeração, por favor, me diga em qual cidade e estado você mora (ex: "Rio de Janeiro, RJ").');
    inputRef.current?.focus();
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

      {awaitingLocationPermission ? (
        <div className="my-2 p-4 border border-accent rounded-md bg-primary">
            <p className="text-neutral mb-3 text-center text-sm">A IA está pedindo sua localização para otimizar a refrigeração.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleAutoLocation} variant="primary" isLoading={isLoading} className="flex-1">
              Permitir Detecção Automática
            </Button>
            <Button onClick={handleManualLocationPrompt} variant="secondary" isLoading={isLoading} className="flex-1">
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

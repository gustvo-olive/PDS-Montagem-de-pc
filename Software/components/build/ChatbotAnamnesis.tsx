import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PreferenciaUsuarioInput, ChatMessage, CityWeatherData, Ambiente, PerfilPCDetalhado } from '../../types'; // Tipos atualizados
import { getChatbotResponse } from '../../services/geminiService';
import { getUserLocation, GeoLocation } from '../../services/geoService';
import { getCityWeather } from '../../services/weatherService'; 
import Button from '../core/Button';
import LoadingSpinner from '../core/LoadingSpinner';

interface ChatbotAnamnesisProps {
  onAnamnesisComplete: (data: PreferenciaUsuarioInput) => void;
  initialAnamnesisData?: PreferenciaUsuarioInput; // Tipo atualizado
}

const LOCATION_PERMISSION_QUESTION = "você permite que detectemos sua localização";
const INITIAL_AI_MESSAGE = "Que tipo de máquina você deseja montar? (ex: Computador Pessoal para Jogos, Servidor, Estação de Trabalho)";


const ChatbotAnamnesis: React.FC<ChatbotAnamnesisProps> = ({ onAnamnesisComplete, initialAnamnesisData }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Estado interno para preferências, inicializado com estrutura aninhada
  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput>(
    initialAnamnesisData || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }
  );
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [awaitingLocationPermission, setAwaitingLocationPermission] = useState<boolean>(false);
  const [locationProcessed, setLocationProcessed] = useState<boolean>(!!initialAnamnesisData?.ambiente?.cidade);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  
  const addMessage = useCallback((sender: 'user' | 'ai' | 'system', text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), sender, text, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    if (messages.length === 0 && (!initialAnamnesisData || Object.keys(initialAnamnesisData.perfilPC).length === 0 && Object.keys(initialAnamnesisData.ambiente).length === 0 )) {
       addMessage('ai', "Olá! Sou o CodeTuga, seu assistente especializado em montagem de PCs. Vamos começar!");
       setTimeout(() => addMessage('ai', INITIAL_AI_MESSAGE), 500);
    }
  }, [addMessage, initialAnamnesisData, messages.length]); 


  const processAiResponse = useCallback((aiResponse: string, updatedPreferenciasFromAI: PreferenciaUsuarioInput) => {
    addMessage('ai', aiResponse);
    setPreferencias(updatedPreferenciasFromAI);
    
    const lowerAiResponse = aiResponse.toLowerCase();

    if (lowerAiResponse.includes(LOCATION_PERMISSION_QUESTION) && !locationProcessed && !updatedPreferenciasFromAI.ambiente.cidade) {
      setAwaitingLocationPermission(true);
    } else if (lowerAiResponse.includes("gerar uma recomendação")) {
      addMessage('system', 'Coleta de requisitos concluída! Clique em "Gerar Recomendação" para continuar.');
    }
  }, [addMessage, locationProcessed]);


  const callGeminiChat = async (input: string, currentData: PreferenciaUsuarioInput) => {
    setIsLoading(true);
    try {
      const { aiResponse, updatedPreferencias } = await getChatbotResponse(messages, input, currentData);
      processAiResponse(aiResponse, updatedPreferencias);
    } catch (error) {
      console.error("Error in chat:", error);
      addMessage('system', 'Desculpe, ocorreu um erro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isLoading || awaitingLocationPermission) return;

    const userMsgText = userInput;
    addMessage('user', userMsgText);
    setUserInput('');
    await callGeminiChat(userMsgText, preferencias);
  };
  
  const isAnamnesisConsideredCompleteByAI = messages.some(
    msg => msg.sender === 'ai' && msg.text.toLowerCase().includes("gerar uma recomendação")
  );
  const preliminaryCheck = !!(preferencias.perfilPC?.machineType && (preferencias.orcamento || preferencias.orcamentoRange));
  const canGenerateRecommendation = isAnamnesisConsideredCompleteByAI && preliminaryCheck;

  useEffect(() => {
    // Focus input when AI is done loading and chat is still active
    if (!isLoading && !awaitingLocationPermission && !canGenerateRecommendation) {
        inputRef.current?.focus();
    }
  }, [isLoading, awaitingLocationPermission, canGenerateRecommendation]);


  const handleLocationPermission = async (allow: boolean) => {
    setAwaitingLocationPermission(false);
    setLocationProcessed(true); 
    setIsLoading(true);
    let systemMessageForGemini = "";
    let currentPrefs = JSON.parse(JSON.stringify(preferencias)) as PreferenciaUsuarioInput; // Deep copy
    if (!currentPrefs.ambiente) currentPrefs.ambiente = {} as Ambiente;


    if (allow) {
      addMessage('system', 'Você permitiu a detecção. Tentando obter sua localização...');
      try {
        const loc: GeoLocation | null = await getUserLocation();
        if (loc && loc.city && loc.latitude && loc.longitude) {
          currentPrefs.ambiente.cidade = loc.city;
          currentPrefs.ambiente.codigoPais = loc.country_code3;
          setPreferencias(currentPrefs); // Update state with city immediately

          let locationMsg = `Localização detectada: ${loc.city}${loc.country_code3 ? ', '+loc.country_code3 : ''}.`;
          addMessage('system', locationMsg);

          const weather = await getCityWeather(loc.latitude, loc.longitude);
          if (weather) {
            currentPrefs.ambiente.temperaturaMediaCidade = weather.avgTemp;
            currentPrefs.ambiente.temperaturaMaximaCidade = weather.maxTemp;
            currentPrefs.ambiente.temperaturaMinimaCidade = weather.minTemp;
            currentPrefs.ambiente.descricaoClimaCidade = weather.description;
            setPreferencias(currentPrefs); // Update state with all weather data

            const weatherMsg = `Clima em ${loc.city}: ${weather.description}, Temp. Média: ${weather.avgTemp}°C, Máx: ${weather.maxTemp}°C, Mín: ${weather.minTemp}°C.`;
            addMessage('system', weatherMsg);
            systemMessageForGemini = `Informação do sistema: ${locationMsg} ${weatherMsg} Prossiga com as perguntas sobre o ambiente específico do PC.`;
          } else {
            addMessage('system', 'Não foi possível obter dados climáticos para esta localização.');
            systemMessageForGemini = `Informação do sistema: ${locationMsg} Não foi possível obter dados climáticos. Prossiga com as perguntas sobre o ambiente específico do PC.`;
          }
          await callGeminiChat(systemMessageForGemini, currentPrefs);

        } else {
          addMessage('system', 'Não foi possível detectar sua localização automaticamente ou dados de coordenadas/cidade não foram retornados.');
          systemMessageForGemini = "Informação do sistema: Detecção de localização automática falhou. Prossiga para perguntas manuais de ambiente geral.";
          await callGeminiChat(systemMessageForGemini, currentPrefs);
        }
      } catch (error) {
        console.error("Error getting location or weather:", error);
        addMessage('system', 'Erro ao tentar detectar localização ou clima.');
        systemMessageForGemini = "Informação do sistema: Erro na detecção de localização/clima. Prossiga para perguntas manuais de ambiente geral.";
        await callGeminiChat(systemMessageForGemini, currentPrefs);
      }
    } else {
      addMessage('system', 'Você não permitiu a detecção automática. Vamos prosseguir com perguntas manuais sobre o ambiente.');
      systemMessageForGemini = "Informação do sistema: Usuário não permitiu detecção automática. Prossiga para perguntas manuais de ambiente geral.";
      await callGeminiChat(systemMessageForGemini, currentPrefs);
    }
    setIsLoading(false);
  };
  
  // Helper para exibir chaves de forma amigável
  const getDisplayKey = (category: string, subKey: string): string => {
    const commonMap: Record<string, string> = {
        orcamento: 'Orçamento (Valor)', orcamentoRange: 'Faixa de Orçamento',
        buildExperience: 'Experiência de Montagem', brandPreference: 'Preferência de Marcas',
        aestheticsImportance: 'Importância da Estética', caseSize: 'Tamanho Gabinete',
        noiseLevel: 'Nível de Ruído', specificPorts: 'Portas Específicas',
        preferences: 'Preferências Adicionais',
    };
    if (category === 'root' && commonMap[subKey]) return commonMap[subKey];

    const perfilPCMap: Record<string, string> = {
        machineType: 'Tipo de Máquina', purpose: 'Propósito Principal', gamingType: 'Tipo de Jogos',
        monitorSpecs: 'Monitor (Jogos)', peripheralsNeeded: 'Periféricos (Jogos)',
        workField: 'Área de Trabalho', softwareUsed: 'Softwares Utilizados',
        multipleMonitors: 'Múltiplos Monitores', monitorCount: 'Qtd. Monitores',
        creativeEditingType: 'Tipo de Edição Criativa', creativeWorkResolution: 'Resolução (Edição)',
        projectSize: 'Tamanho Projetos (Edição)', serverType: 'Tipo de Servidor', 
        serverUsers: 'Usuários (Servidor)', serverRedundancy: 'Redundância (Servidor)', 
        serverUptime: 'Uptime (Servidor)', serverScalability: 'Escalabilidade (Servidor)', 
        miningCrypto: 'Criptomoedas', miningHashrate: 'Hashrate (Mineração)', 
        miningGpuCount: 'GPUs (Mineração)', miningEnergyCost: 'Custo Energia (Mineração)',
        isCustomType: 'Tipo Customizado?', customDescription: 'Descrição (Custom)', 
        criticalComponents: 'Componentes Críticos (Custom)', usagePatterns: 'Padrões de Uso (Custom)',
        physicalConstraints: 'Restrições Físicas (Custom)', specialRequirements: 'Requisitos Especiais (Custom)',
        referenceSystems: 'Sistemas de Referência (Custom)', workType: 'Tipo de Trabalho (Legado)'
    };
    if (category === 'perfilPC' && perfilPCMap[subKey]) return perfilPCMap[subKey];
    
    const ambienteMap: Record<string, string> = {
        cidade: 'Cidade', codigoPais: 'País', temperaturaMediaCidade: 'Temp. Média Cidade',
        temperaturaMaximaCidade: 'Temp. Máx. Cidade', temperaturaMinimaCidade: 'Temp. Mín. Cidade',
        descricaoClimaCidade: 'Clima Cidade', ventilacaoLocalPC: 'Ventilação PC (Local)',
        nivelPoeiraLocalPC: 'Poeira PC (Local)', comodoPC: 'Cômodo PC (Local)',
        controleTemperaturaGeral: 'Controle Temp. (Geral)', nivelPoeiraGeral: 'Poeira (Geral)',
        temperatura: 'Temperatura (Ambiente)', umidade: 'Umidade (Ambiente)',
        climatizacao: 'Climatização (Ambiente)', localizacao: 'Localização (Ambiente)'
    };
    if (category === 'ambiente' && ambienteMap[subKey]) return ambienteMap[subKey];

    let display = subKey.replace(/([A-Z])/g, ' $1');
    return display.charAt(0).toUpperCase() + display.slice(1);
  };

  const renderCollectedData = (data: any, category: string, prefix = ''): JSX.Element[] => {
    return Object.entries(data)
      .filter(([key, value]) => value !== undefined && value !== null && value !== '' && !(typeof value === 'boolean' && !value) && typeof value !== 'object')
      .sort(([keyA], [keyB]) => getDisplayKey(category, keyA).localeCompare(getDisplayKey(category, keyB)))
      .map(([key, value]) => {
        let displayValue = String(value);
        if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
        if ((key === 'temperaturaMediaCidade' || key === 'temperaturaMaximaCidade' || key === 'temperaturaMinimaCidade') && typeof value === 'number') displayValue += '°C';
        if (key === 'orcamento' && typeof value === 'number') displayValue = `R$ ${value.toFixed(2)}`;
        
        return <li key={prefix + key}><span className="font-medium">{getDisplayKey(category, key)}:</span> {displayValue}</li>;
      });
  };


  return (
    <div className="bg-secondary p-6 rounded-lg shadow-xl max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold text-accent mb-4 text-center">Converse Comigo para Montar seu PC</h2>
      <div className="h-96 overflow-y-auto p-4 border border-neutral-dark rounded-md mb-4 bg-primary space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow ${
                msg.sender === 'user' ? 'bg-accent text-primary' : 
                msg.sender === 'ai' ? 'bg-neutral-dark text-neutral' : 
                'bg-yellow-500 text-black text-sm italic text-center w-full' 
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-right text-primary/70' : 'text-left text-neutral/70'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length -1].sender !== 'ai' && (
             <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow bg-neutral-dark text-neutral">
                    <LoadingSpinner size="sm" text="Digitando..." />
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {awaitingLocationPermission ? (
        <div className="my-4 p-4 border border-accent rounded-md bg-primary">
          <p className="text-neutral mb-3 text-center">
            {messages.find(m => m.text.toLowerCase().includes(LOCATION_PERMISSION_QUESTION.toLowerCase()))?.text || "Gostaria de permitir a detecção de localização?"}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => handleLocationPermission(true)} variant="primary" isLoading={isLoading} className="flex-1">
              Permitir Detecção Automática
            </Button>
            <Button onClick={() => handleLocationPermission(false)} variant="secondary" isLoading={isLoading} className="flex-1">
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
            placeholder="Digite sua mensagem..."
            className="flex-grow p-3 bg-primary border border-neutral-dark rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none text-neutral placeholder-neutral-dark"
            disabled={isLoading || canGenerateRecommendation}
            aria-label="Sua mensagem para o chatbot"
          />
          <Button type="submit" isLoading={isLoading} disabled={!userInput.trim() || canGenerateRecommendation}>
            Enviar
          </Button>
        </form>
      )}

      {canGenerateRecommendation && !awaitingLocationPermission && (
        <div className="mt-6 text-center">
            <p className="text-green-400 mb-3">Coleta de requisitos concluída!</p>
            <Button onClick={() => onAnamnesisComplete(preferencias)} variant="primary" size="lg">
                Gerar Recomendação de Build
            </Button>
        </div>
      )}
      <div className="mt-4 p-3 bg-primary/50 border border-neutral-dark/50 rounded-md text-xs max-h-48 overflow-y-auto">
        <h4 className="font-semibold text-accent mb-1">Dados Coletados (PreferenciasUsuarioInput):</h4>
        <ul className="list-disc list-inside">
            {renderCollectedData(preferencias, 'root')}
            {preferencias.perfilPC && Object.keys(preferencias.perfilPC).length > 0 && (
              <>
                <li className="font-semibold text-accent/80 mt-1">Perfil do PC:</li>
                <ul className="list-disc list-inside pl-4">
                  {renderCollectedData(preferencias.perfilPC, 'perfilPC')}
                </ul>
              </>
            )}
            {preferencias.ambiente && Object.keys(preferencias.ambiente).length > 0 && (
              <>
                <li className="font-semibold text-accent/80 mt-1">Ambiente:</li>
                <ul className="list-disc list-inside pl-4">
                  {renderCollectedData(preferencias.ambiente, 'ambiente')}
                </ul>
              </>
            )}
        </ul>
      </div>
    </div>
  );
};

export default ChatbotAnamnesis;
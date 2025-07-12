/**
 * @file Página de Montagem (BuildPage).
 * @module pages/BuildPage
 * @description Este é o componente principal que orquestra todo o fluxo de montagem de um PC.
 * Ele gerencia o estado da build, a interação com o chatbot, a exibição do resumo,
 * o carregamento de builds salvas, e o fluxo de autenticação para salvar/exportar.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreferenciaUsuarioInput, Build, Componente, Ambiente, PerfilPCDetalhado, BuildPhase, ChatMessage } from '../types';
import ChatbotAnamnesis from '../components/build/ChatbotAnamnesis';
import BuildSummary from '../components/build/BuildSummary';
import LoadingSpinner from '../components/core/LoadingSpinner';
import Button from '../components/core/Button';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/core/Modal';
import { supabase } from '../services/supabaseClient';
import { getComponents } from '../services/componentService';
import { conductAnamnesis, generateOrUpdateBuild } from '../services/geminiService';
import { getUserLocation, GeoLocation } from '../../services/geoService';
import { getCityWeather } from '../../services/weatherService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

// Chaves usadas para armazenar dados temporários na sessionStorage.
const SESSION_PENDING_BUILD_KEY = 'pendingBuild';
const SESSION_PROCEEDED_ANONYMOUSLY_KEY = 'proceededAnonymously';
const SESSION_PENDING_PREFERENCIAS_KEY = 'pendingPreferencias';


/**
 * @component BuildPage
 * @description Orquestrador central da funcionalidade de montagem de PC.
 * Esta página combina o `ChatbotAnamnesis` e o `BuildSummary` para criar uma
 * experiência de montagem em tempo real. Ela também gerencia o estado da build,
 * carrega componentes, lida com builds salvas via URL, e gerencia o fluxo
 * de autenticação para ações como salvar e exportar.
 * @returns {React.ReactElement} A página de montagem de PC interativa.
 */
export const BuildPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Estados principais da página
  const [buildPhase, setBuildPhase] = useState<BuildPhase>('anamnesis');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput>({ perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading inicial de componentes
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [availableComponents, setAvailableComponents] = useState<Componente[] | null>(null);
  
  // Estado para build salva
  const [isViewingSavedBuild, setIsViewingSavedBuild] = useState<boolean>(false);

  // Estados para gerenciar o fluxo de autenticação e permissões.
  const [isAuthInfoModalOpen, setIsAuthInfoModalOpen] = useState<boolean>(false);
  const [pendingActionForAuth, setPendingActionForAuth] = useState<'save' | 'export' | null>(null);
  const [isAwaitingLocationPermission, setAwaitingLocationPermission] = useState<boolean>(false);
  const hasProceededAnonymously = useRef<boolean>(sessionStorage.getItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY) === 'true');

  const pageInitialized = useRef(false);

  // Efeito para carregar a lista de componentes disponíveis na montagem do componente.
  useEffect(() => {
    const fetchComponents = async () => {
        setIsLoading(true);
        try {
            const components = await getComponents();
            if (components.length > 0) {
                setAvailableComponents(components);
            } else {
                setError("Não foi possível carregar os componentes disponíveis. A montagem IA está desabilitada.");
            }
        } catch (e: any) {
             setError(`Erro ao carregar componentes: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    fetchComponents();
  }, []);

  const addMessage = useCallback((sender: 'user' | 'ai' | 'system', text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, text, timestamp: Date.now() }]);
  }, []);

  // Efeito para iniciar a conversa
  useEffect(() => {
    if (pageInitialized.current || messages.length > 0 || isViewingSavedBuild || isLoading || !availableComponents) return;
    
    addMessage('ai', "Olá! Sou o CodeTuga, seu assistente especializado. Vamos começar a definir os requisitos para o seu novo PC. Qual o seu orçamento?");
    pageInitialized.current = true;
  }, [addMessage, messages.length, isViewingSavedBuild, isLoading, availableComponents]);
  
  /**
   * Extrai a string de notas (justificativa e avisos) da build para exibição.
   * @param build - O objeto da build.
   * @returns A string de notas da IA ou undefined.
   * @private
   */
  const getNotesFromBuild = (build: Build | null): string | undefined => {
      if (!build) return undefined;
      return build.justificativa;
  };

  /**
   * Reseta todo o estado da página para iniciar uma nova montagem do zero.
   * @private
   */
  const resetBuildState = useCallback(() => {
    setBuildPhase('anamnesis');
    setMessages([]);
    setPreferencias({ perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
    setCurrentBuild(null);
    setError(null);
    setIsViewingSavedBuild(false);
    pageInitialized.current = false;
    sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
    sessionStorage.removeItem(SESSION_PENDING_PREFERENCIAS_KEY);
    setPendingActionForAuth(null);
    navigate('/build', { replace: true, state: { newBuild: true, timestamp: Date.now() } });
  }, [navigate]);

  const handleSendMessage = useCallback(async (userInput: string) => {
    addMessage('user', userInput);
    setIsAiThinking(true);

    try {
        if (buildPhase === 'anamnesis') {
            const response = await conductAnamnesis(messages, userInput, preferencias);
            if (!response) throw new Error("A IA não retornou uma resposta válida.");
            
            addMessage('ai', response.aiResponseText);
            setPreferencias(response.updatedPreferencias);

            if (response.actionRequired === 'request_location_permission') {
              setAwaitingLocationPermission(true);
            }

            if (response.isComplete) {
                setBuildPhase('generating');
                addMessage('system', 'Ótimo, requisitos coletados! Gerando sua build inicial...');

                const buildResponse = await generateOrUpdateBuild("GENERATE_INITIAL_BUILD", response.updatedPreferencias, availableComponents!, null);
                if (!buildResponse) throw new Error("Falha ao gerar a build inicial.");

                const componentMap = new Map(availableComponents!.map(c => [c.id, c]));
                const recommendedComponents = buildResponse.recommendedComponentIds
                    .map(id => componentMap.get(id))
                    .filter((c): c is Componente => Boolean(c));

                const newBuild: Build = {
                    id: crypto.randomUUID(),
                    nome: `Build para ${buildResponse.updatedPreferencias.perfilPC.purpose || 'Uso Geral'}`,
                    componentes: recommendedComponents,
                    orcamento: buildResponse.estimatedTotalPrice,
                    dataCriacao: new Date().toISOString(),
                    requisitos: buildResponse.updatedPreferencias,
                    justificativa: buildResponse.justification,
                };
                setCurrentBuild(newBuild);
                setPreferencias(buildResponse.updatedPreferencias);
                addMessage('ai', buildResponse.aiResponseText);
                setBuildPhase('editing');
            }
        } else if (buildPhase === 'editing') {
             const buildResponse = await generateOrUpdateBuild(userInput, preferencias, availableComponents!, currentBuild);
             if (!buildResponse) throw new Error("Falha ao atualizar a build.");

             const componentMap = new Map(availableComponents!.map(c => [c.id, c]));
             const recommendedComponents = buildResponse.recommendedComponentIds
                 .map(id => componentMap.get(id))
                 .filter((c): c is Componente => Boolean(c));

             const updatedBuild: Build = {
                ...(currentBuild!),
                 id: currentBuild!.id,
                 componentes: recommendedComponents,
                 orcamento: buildResponse.estimatedTotalPrice,
                 requisitos: buildResponse.updatedPreferencias,
                 justificativa: buildResponse.justification,
             };
             setCurrentBuild(updatedBuild);
             setPreferencias(buildResponse.updatedPreferencias);
             addMessage('ai', buildResponse.aiResponseText);
        }
    } catch (error: any) {
        console.error("Error handling message:", error);
        addMessage('system', error.message || 'Desculpe, ocorreu um erro. Tente novamente.');
    } finally {
        setIsAiThinking(false);
    }
  }, [addMessage, buildPhase, messages, preferencias, availableComponents, currentBuild]);

  /**
   * Executa a lógica de salvar a build no Supabase, chamando uma função RPC.
   * @param buildToSave - O objeto da build a ser salvo.
   * @private
   */
  const executeActualSaveBuild = useCallback(async (buildToSave: Build) => {
    if (!currentUser) {
      toast.error("Erro: Usuário não está logado para salvar.");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
        const sanitizedRequisitos = buildToSave.requisitos
            ? JSON.parse(JSON.stringify(buildToSave.requisitos))
            : null;
        
        const justificationText = buildToSave.justificativa || '';
        const warningsRegex = /Avisos de Compatibilidade:([\s\S]*)/i;
        const warningsMatch = justificationText.match(warningsRegex);
        const warningsText = warningsMatch ? warningsMatch[1].trim() : '';
        const warnings = warningsText ? warningsText.split('\n').map(w => w.replace(/^- /, '').trim()).filter(Boolean) : [];

        const { error: rpcError } = await supabase.rpc('upsert_build_with_components', {
            p_build_id: buildToSave.id,
            p_nome: buildToSave.nome,
            p_orcamento: buildToSave.orcamento,
            p_data_criacao: buildToSave.dataCriacao,
            p_requisitos: sanitizedRequisitos,
            p_avisos_compatibilidade: warnings,
            p_component_ids: buildToSave.componentes.map(c => c.id)
        });

        if (rpcError) throw rpcError;

        toast.success(`Build "${buildToSave.nome}" salva com sucesso!`);
        setCurrentBuild(buildToSave);
        setIsViewingSavedBuild(true);
        navigate(`/build/${buildToSave.id}`, { replace: true });

    } catch (error: any) {
        console.error("Save build raw error object:", error);
        const fullMessage = `Ocorreu um erro inesperado ao salvar: ${error.message || 'Detalhes desconhecidos.'}`;
        setError(fullMessage);
        toast.error(fullMessage);
    } finally {
        setIsSaving(false);
    }
  }, [currentUser, navigate]);

  /**
   * Gera e faz o download de um arquivo PDF com o resumo da build.
   * @param buildToExport - O objeto da build a ser exportado.
   * @private
   */
  const executeActualExportBuild = useCallback((buildToExport: Build) => {
    const doc = new jsPDF();
    const notesForExport = getNotesFromBuild(buildToExport);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(`Resumo da Build: ${buildToExport.nome}`, 14, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Data: ${new Date(buildToExport.dataCriacao).toLocaleDateString()}`, 14, 30);
    doc.text(`Preço Total Estimado: R$ ${buildToExport.orcamento.toFixed(2)}`, 14, 36);
    
    let startY = 45;
    if (notesForExport) {
        const splitNotes = doc.splitTextToSize(notesForExport, 180);
        doc.text(splitNotes, 14, startY);
        startY += (splitNotes.length * 5) + 5;
    }

    const head = [['Produto', 'Preço', 'Oferta']];
    const body = buildToExport.componentes.map(c => [
        c.Produto,
        `R$ ${c.Preco.toFixed(2)}`,
        c.LinkCompra ? 'Ver Oferta' : 'N/A'
    ]);

    autoTable(doc, {
        head,
        body,
        startY,
        headStyles: { fillColor: [13, 27, 42] },
        willDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const component = buildToExport.componentes[data.row.index];
                if (component && component.LinkCompra) data.cell.styles.textColor = [65, 234, 212];
            }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const component = buildToExport.componentes[data.row.index];
                if (component && component.LinkCompra) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: component.LinkCompra });
            }
        }
    });

    doc.save(`${buildToExport.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
  }, []); 

  // Efeito para lidar com a navegação e o carregamento de builds salvas a partir da URL.
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const buildId = pathParts.length > 2 && pathParts[1] === 'build' ? pathParts[2] : null;

    if (location.state?.newBuild) {
        if(pageInitialized.current) resetBuildState();
        return;
    }
    
    if (buildId) {
        if ((isViewingSavedBuild && currentBuild?.id === buildId)) return;
      
        setIsLoading(true);
        const fetchSavedBuild = async () => {
            if(!availableComponents?.length) {
                // Espera os componentes carregarem
                return;
            }
            
            const { data, error: fetchError } = await supabase.from('builds').select('*, build_components(component_id)').eq('id', buildId).single();
            if (fetchError) {
                setError(`A build com o ID '${buildId}' não foi encontrada.`);
                resetBuildState();
            } else if (data) {
                const componentMap = new Map(availableComponents.map(c => [c.id, c]));
                const components = (data.build_components as any[]).map(bc => componentMap.get(String(bc.component_id))).filter(Boolean);
                
                const warnings = data.avisos_compatibilidade || [];
                const justificationFromDb = `Avisos de Compatibilidade:\n${warnings.map(w => `- ${w}`).join('\n')}`;

                const formattedBuild: Build = {
                    id: data.id, nome: data.nome, orcamento: data.orcamento, dataCriacao: data.data_criacao,
                    justificativa: data.requisitos?.justificativa || justificationFromDb,
                    avisos_compatibilidade: warnings,
                    requisitos: data.requisitos as PreferenciaUsuarioInput || undefined,
                    componentes: components as Componente[], userId: data.user_id,
                };
                setCurrentBuild(formattedBuild);
                setPreferencias(formattedBuild.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
                setIsViewingSavedBuild(true);
                setBuildPhase('editing');
            }
            setIsLoading(false);
        };
        fetchSavedBuild();
    }
  }, [location.pathname, location.state, currentBuild?.id, isViewingSavedBuild, resetBuildState, navigate, availableComponents]);

  // Efeito para gerenciar a lógica de autenticação pós-ação (ex: salvar build após login).
  useEffect(() => {
    if (!currentUser && !location.pathname.includes('/build/') && !hasProceededAnonymously.current && buildPhase === 'anamnesis' && !isLoading && availableComponents) {
      setIsAuthInfoModalOpen(true);
    }
    if (currentUser && location.state?.fromLogin && location.state?.action) {
      const action = location.state.action as 'save' | 'export';
      const storedBuildJSON = sessionStorage.getItem(SESSION_PENDING_BUILD_KEY);

      if (storedBuildJSON) {
        const buildToProcess: Build = JSON.parse(storedBuildJSON);
        const storedPreferenciasJSON = sessionStorage.getItem(SESSION_PENDING_PREFERENCIAS_KEY);

        setCurrentBuild(buildToProcess);
        if(storedPreferenciasJSON) setPreferencias(JSON.parse(storedPreferenciasJSON));
        
        const timerId = setTimeout(() => {
            if (action === 'save') executeActualSaveBuild(buildToProcess);
            else if (action === 'export') executeActualExportBuild(buildToProcess);
        }, 100);

        sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
        sessionStorage.removeItem(SESSION_PENDING_PREFERENCIAS_KEY);
        setPendingActionForAuth(null);
        navigate(location.pathname, { state: {}, replace: true }); 
        return () => clearTimeout(timerId);
      }
    }
  }, [currentUser, location, navigate, isLoading, executeActualSaveBuild, executeActualExportBuild, availableComponents, buildPhase]);
  
  const handleLocationPermissionFlow = useCallback(async (allow: boolean) => {
    setAwaitingLocationPermission(false);
    let systemMessageForAnamnesis = "";
    let updatedPrefs = JSON.parse(JSON.stringify(preferencias)) as PreferenciaUsuarioInput;
    if (!updatedPrefs.ambiente) updatedPrefs.ambiente = {} as Ambiente;

    if (allow) {
        addMessage('system', 'Tentando obter sua localização e dados climáticos anuais...');
        setIsAiThinking(true);
        try {
            const loc: GeoLocation | null = await getUserLocation();
            if (loc && loc.city) {
                updatedPrefs.ambiente.cidade = loc.city;
                updatedPrefs.ambiente.codigoPais = loc.country_code3;
                addMessage('system', `Localização detectada: ${loc.city}.`);

                const weather = await getCityWeather(loc.latitude, loc.longitude);
                if (weather) {
                    updatedPrefs.ambiente.temperaturaMediaAnual = weather.avgTemp;
                    updatedPrefs.ambiente.temperaturaMaximaAnual = weather.maxTemp;
                    updatedPrefs.ambiente.temperaturaMinimaAnual = weather.minTemp;
                    addMessage('system', `Clima anual em ${loc.city}: Média ${weather.avgTemp}°C, Máx ${weather.maxTemp}°C.`);
                    systemMessageForAnamnesis = `O usuário permitiu a localização. Dados de clima coletados. Continue a anamnese.`;
                } else {
                     addMessage('system', 'Não foi possível obter os dados climáticos.');
                     systemMessageForAnamnesis = `Localização detectada, mas sem dados de clima. Continue a anamnese.`;
                }
            } else {
                addMessage('system', 'Não foi possível detectar sua localização automaticamente.');
                systemMessageForAnamnesis = `Falha na detecção automática. Peça ao usuário para informar a cidade manualmente.`;
            }
        } catch (error) {
             addMessage('system', 'Ocorreu um erro ao obter a localização.');
             systemMessageForAnamnesis = `Erro técnico na detecção de localização. Peça ao usuário para informar a cidade manualmente.`;
        }
    } else {
        addMessage('system', 'Usuário não permitiu detecção automática.');
        systemMessageForAnamnesis = `O usuário negou a permissão de localização. Peça para ele informar a cidade manualmente.`;
    }

    setPreferencias(updatedPrefs);
    // Chama a IA novamente com o contexto da decisão de localização
    handleSendMessage(systemMessageForAnamnesis);

  }, [addMessage, handleSendMessage, preferencias]);


  const handleLoginForBuild = () => {
    setIsAuthInfoModalOpen(false);
    navigate('/login', { state: { from: location, pendingAction: pendingActionForAuth } });
  };
  const handleContinueAnonymously = () => {
    setIsAuthInfoModalOpen(false);
    hasProceededAnonymously.current = true;
    sessionStorage.setItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY, 'true');
  };

  /**
   * Dispara uma ação que requer autenticação ('save' ou 'export').
   * Se o usuário não estiver logado, armazena a ação e a build no sessionStorage
   * e abre o modal de login. Caso contrário, executa a ação diretamente.
   * @param action - A ação a ser executada.
   * @private
   */
  const triggerAuthenticatedAction = (action: 'save' | 'export') => {
    if (!currentBuild || !preferencias) return;
    if (!currentUser) {
      sessionStorage.setItem(SESSION_PENDING_BUILD_KEY, JSON.stringify(currentBuild));
      sessionStorage.setItem(SESSION_PENDING_PREFERENCIAS_KEY, JSON.stringify(preferencias));
      setPendingActionForAuth(action);
      setIsAuthInfoModalOpen(true);
    } else {
      if (action === 'save') executeActualSaveBuild(currentBuild);
      if (action === 'export') executeActualExportBuild(currentBuild);
    }
  };
  
  const triggerSaveBuild = () => triggerAuthenticatedAction('save');
  const triggerExportBuild = () => triggerAuthenticatedAction('export');

  const aiNotesToDisplay = getNotesFromBuild(currentBuild);

  /**
   * Renderiza o conteúdo principal da página com base no estado atual (carregando, erro, visualizando, etc.).
   * @returns O elemento React a ser renderizado.
   * @private
   */
  const renderContent = () => {
    if (isLoading) {
       return <div className="text-center py-10"><LoadingSpinner size="lg" text={'Carregando componentes...'} /></div>;
    }
    if (error) {
      return (
        <div className="my-6 p-6 bg-red-800/90 text-red-100 rounded-lg text-center">
          <h3 className="text-2xl font-semibold mb-3">Oops! Algo deu errado.</h3>
          <p className="mb-4 whitespace-pre-wrap">{error}</p>
          <Button onClick={resetBuildState} variant="secondary" size="lg">Tentar Novamente</Button>
        </div>
      );
    }
    if (isViewingSavedBuild) {
        return (
             <>
              <BuildSummary build={currentBuild} phase="editing" onSaveBuild={triggerSaveBuild} isSaving={isSaving} onExportBuild={triggerExportBuild} aiRecommendationNotes={aiNotesToDisplay} />
              <div className="mt-6 text-center">
                <Button onClick={resetBuildState} variant="secondary" size="lg">
                    Iniciar Nova Montagem com IA
                </Button>
              </div>
            </>
        );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
            <ChatbotAnamnesis 
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isAiThinking}
              isAwaitingLocationPermission={isAwaitingLocationPermission}
              onAllowLocation={() => handleLocationPermissionFlow(true)}
              onDenyLocation={() => handleLocationPermissionFlow(false)}
            />
        </div>
        <div className="lg:col-span-2 mt-8 lg:mt-0">
            <div className="sticky top-24">
              <BuildSummary 
                  build={currentBuild} 
                  phase={buildPhase}
                  isSaving={isSaving}
                  onSaveBuild={currentBuild ? triggerSaveBuild : undefined}
                  onExportBuild={currentBuild ? triggerExportBuild : undefined}
                  aiRecommendationNotes={aiNotesToDisplay}
              />
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      {isAuthInfoModalOpen && (
        <Modal
          isOpen={isAuthInfoModalOpen}
          onClose={pendingActionForAuth ? () => setIsAuthInfoModalOpen(false) : handleContinueAnonymously}
          title={pendingActionForAuth ? "Login Necessário" : "Aviso: Montagem Anônima"}
        >
          {pendingActionForAuth ? (
            <div>
              <p className="text-neutral-dark mb-6">
                Você precisa estar logado para {pendingActionForAuth === 'save' ? 'salvar' : 'exportar'} sua build.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsAuthInfoModalOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleLoginForBuild}>Fazer Login</Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-neutral-dark mb-6">
                Para salvar seu progresso, recomendamos criar uma conta ou fazer login.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="secondary" onClick={handleContinueAnonymously} className="flex-1">Continuar como Visitante</Button>
                <Button variant="primary" onClick={handleLoginForBuild} className="flex-1">Login / Cadastrar</Button>
              </div>
            </div>
          )}
        </Modal>
      )}
      {renderContent()}
    </div>
  );
};

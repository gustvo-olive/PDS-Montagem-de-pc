
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreferenciaUsuarioInput, Build, Componente, SelectedComponent, AIRecommendation, Ambiente, PerfilPCDetalhado } from '../types';
import ChatbotAnamnesis from '../components/build/ChatbotAnamnesis';
import BuildSummary from '../components/build/BuildSummary';
import LoadingSpinner from '../components/core/LoadingSpinner';
import Button from '../components/core/Button';
import { getBuildRecommendation } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/core/Modal';
import { supabase } from '../services/supabaseClient';

const SESSION_PENDING_BUILD_KEY = 'pendingBuild';
const SESSION_PENDING_AI_NOTES_KEY = 'pendingAiNotes';
const SESSION_PROCEEDED_ANONYMOUSLY_KEY = 'proceededAnonymously';

const BuildPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput | null>(null);
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState<string | undefined>(undefined);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportedText, setExportedText] = useState<string>('');
  const [isViewingSavedBuild, setIsViewingSavedBuild] = useState<boolean>(false);
  const [availableComponents, setAvailableComponents] = useState<Componente[] | null>(null);

  const [isAuthInfoModalOpen, setIsAuthInfoModalOpen] = useState<boolean>(false);
  const [pendingActionForAuth, setPendingActionForAuth] = useState<'save' | 'export' | null>(null);
  const hasProceededAnonymously = useRef<boolean>(sessionStorage.getItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY) === 'true');

  // Fetch available components from Supabase on mount
  useEffect(() => {
    const fetchComponents = async () => {
        const { data, error } = await supabase.from('components').select('*');
        if (error) {
            console.error("Error fetching components:", error);
            setError("Não foi possível carregar os componentes disponíveis. A montagem IA está desabilitada.");
        } else {
            setAvailableComponents(data as Componente[]);
        }
    };
    fetchComponents();
  }, []);

  const resetBuildState = useCallback(() => {
    setPreferencias(null);
    setCurrentBuild(null);
    setError(null);
    setAiNotes(undefined);
    setIsViewingSavedBuild(false);
    sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
    sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
    setPendingActionForAuth(null);
  }, []);

  const executeActualSaveBuild = useCallback(async (buildToSave: Build) => {
    if (!currentUser) {
      console.error("Attempted to save build without a logged-in user.");
      alert("Erro: Usuário não está logado para salvar.");
      return;
    }
    
    setIsLoading(true);
    // 1. Prepare and upsert the build itself (without components)
    const buildPayload = {
        id: buildToSave.id,
        user_id: currentUser.id,
        nome: buildToSave.nome,
        orcamento: buildToSave.orcamento,
        data_criacao: buildToSave.dataCriacao,
        requisitos: buildToSave.requisitos as any,
        avisos_compatibilidade: buildToSave.avisosCompatibilidade,
    };

    const { error: buildError } = await supabase.from('builds').upsert(buildPayload);

    if (buildError) {
      console.error("Error saving build:", buildError);
      alert(`Falha ao salvar a build: ${buildError.message}`);
      setIsLoading(false);
      return;
    }

    // 2. Clear existing components for this build to handle updates correctly
    const { error: deleteError } = await supabase.from('build_components').delete().eq('build_id', buildToSave.id);
    if (deleteError) {
      console.error("Error clearing old components:", deleteError);
      // continue anyway, maybe it was a new build
    }

    // 3. Insert new component relations
    const buildComponentsPayload = buildToSave.componentes.map(comp => ({
      build_id: buildToSave.id,
      component_id: comp.id,
    }));

    if (buildComponentsPayload.length > 0) {
      const { error: componentsError } = await supabase.from('build_components').insert(buildComponentsPayload);
      if (componentsError) {
        console.error("Error saving build components:", componentsError);
        alert(`Falha ao salvar os componentes da build: ${componentsError.message}`);
        setIsLoading(false);
        return;
      }
    }
    
    setIsLoading(false);
    alert(`Build "${buildToSave.nome}" salva com sucesso!`);
    navigate(`/build/${buildToSave.id}`, { replace: true });
    setIsViewingSavedBuild(true);

  }, [currentUser, navigate]);

  const executeActualExportBuild = useCallback((buildToExport: Build, notesForExport?: string) => {
    let text = `Build: ${buildToExport.nome}\n`;
    text += `Data: ${new Date(buildToExport.dataCriacao).toLocaleDateString()}\n`;
    text += `Preço Total Estimado: R$ ${buildToExport.orcamento.toFixed(2)}\n\n`;
    text += `Componentes:\n`;
    buildToExport.componentes.forEach(c => {
      text += `- ${c.tipo}: ${c.nome} (${c.brand}) - R$ ${c.preco.toFixed(2)}\n`;
    });

    if(buildToExport.requisitos){
      text += `\nRequisitos:\n`;
      const formatRequisitos = (obj: any, indent = "") => {
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
              text += `${indent}- ${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:\n`;
              formatRequisitos(obj[key], indent + "  ");
            } else {
              let displayValue = String(obj[key]);
              if (typeof obj[key] === 'boolean') displayValue = obj[key] ? 'Sim' : 'Não';
              if ((key.toLowerCase().includes('temp') || key.toLowerCase().includes('temperatura')) && typeof obj[key] === 'number') displayValue = `${(obj[key] as number).toFixed(0)}°C`;
              else if (key === 'orcamento' && typeof obj[key] === 'number') displayValue = `R$ ${(obj[key] as number).toFixed(2)}`;
              
              const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              text += `${indent}- ${displayKey}: ${displayValue}\n`;
            }
          }
        }
      };
      formatRequisitos(buildToExport.requisitos);
    }

    if(notesForExport) text += `\nNotas da IA:\n${notesForExport}\n`;
    if(buildToExport.avisosCompatibilidade && buildToExport.avisosCompatibilidade.length > 0){
      text += `\nAvisos de Compatibilidade:\n`;
      buildToExport.avisosCompatibilidade.forEach(issue => text += `- ${issue}\n`);
    }
    setExportedText(text);
    setIsExportModalOpen(true);
  }, []); 

  // Effect to handle loading/resetting the build state based on URL/navigation
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const buildId = pathParts.length > 2 && pathParts[1] === 'build' ? pathParts[2] : null;

    if (location.state?.newBuild) {
      resetBuildState();
      navigate('/build', { replace: true });
      return;
    }

    if (buildId) {
      if (currentBuild?.id === buildId) return;

      setIsLoading(true);
      const fetchSavedBuild = async () => {
        const { data, error } = await supabase
          .from('builds')
          .select(`
            *,
            componentes:build_components(
              components(*)
            )
          `)
          .eq('id', buildId)
          .single();

        if (error) {
          setError(`A build com o ID '${buildId}' não foi encontrada ou você não tem permissão para vê-la.`);
          resetBuildState();
        } else if (data) {
          // @ts-ignore
          const components = data.componentes.map(bc => bc.components).filter(Boolean);
          const formattedBuild: Build = {
            id: data.id,
            nome: data.nome,
            orcamento: data.orcamento,
            dataCriacao: data.data_criacao,
            avisosCompatibilidade: data.avisos_compatibilidade || [],
            requisitos: data.requisitos as PreferenciaUsuarioInput || undefined,
            componentes: components as SelectedComponent[],
            userId: data.user_id,
          };
          setCurrentBuild(formattedBuild);
          setPreferencias(formattedBuild.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
          setAiNotes(undefined);
          setError(null);
          setIsViewingSavedBuild(true);
        }
        setIsLoading(false);
      };
      fetchSavedBuild();
    }
  }, [location.pathname, location.state, currentBuild?.id, resetBuildState, navigate]);

  // Effect to handle auth modal and post-login actions
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const buildIdFromPath = pathParts.length > 2 && pathParts[1] === 'build' ? pathParts[2] : null;
    
    if (
      !currentUser && !buildIdFromPath && !hasProceededAnonymously.current &&
      !preferencias && !currentBuild && !isLoading && !error &&
      !pendingActionForAuth && !sessionStorage.getItem(SESSION_PENDING_BUILD_KEY)
    ) {
      setIsAuthInfoModalOpen(true);
    }

    if (currentUser && location.state?.fromLogin && location.state?.action) {
      const action = location.state.action as 'save' | 'export';
      const storedBuildJSON = sessionStorage.getItem(SESSION_PENDING_BUILD_KEY);
      const storedAiNotesJSON = sessionStorage.getItem(SESSION_PENDING_AI_NOTES_KEY);

      if (storedBuildJSON) {
        try {
            const buildToProcess: Build = JSON.parse(storedBuildJSON);
            const notesToProcess: string | undefined = storedAiNotesJSON ? JSON.parse(storedAiNotesJSON) : undefined;
            
            // Restore state before executing action
            setCurrentBuild(buildToProcess);
            setPreferencias(buildToProcess.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
            setAiNotes(notesToProcess);
            setError(null);
            setIsLoading(false);

            const timerId = setTimeout(() => {
                if (action === 'save') executeActualSaveBuild(buildToProcess);
                else if (action === 'export') executeActualExportBuild(buildToProcess, notesToProcess);
            }, 100);
            
            sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
            sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
            setPendingActionForAuth(null);
            navigate(location.pathname, { state: {}, replace: true });
            return () => clearTimeout(timerId);
        } catch (e) {
            setError("Erro ao processar build pendente.");
            sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
            sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
        }
      }
    }
  }, [currentUser, location, navigate, preferencias, currentBuild, isLoading, error, pendingActionForAuth, executeActualSaveBuild, executeActualExportBuild]);


  const handleLoginForBuild = () => {
    setIsAuthInfoModalOpen(false);
    navigate('/login', { state: { from: location, pendingAction: pendingActionForAuth } });
  };

  const handleContinueAnonymously = () => {
    setIsAuthInfoModalOpen(false);
    hasProceededAnonymously.current = true;
    sessionStorage.setItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY, 'true');
  };
  
  const handleAnamnesisComplete = useCallback((data: PreferenciaUsuarioInput) => {
    if (!availableComponents) {
        setError("Os componentes não estão disponíveis. A montagem IA não pode continuar.");
        return;
    }
    setPreferencias(data);
    setIsLoading(true);
    setError(null);
    setAiNotes(undefined);
    setCurrentBuild(null); 
    setIsViewingSavedBuild(false);
    
    getBuildRecommendation(data, availableComponents)
      .then(recommendation => {
        if (recommendation && availableComponents) {
          const recommendedCompDetails: Componente[] = availableComponents.filter(c => recommendation.recommendedComponentIds.includes(c.id));
          const selectedComponents: SelectedComponent[] = recommendedCompDetails.map(comp => ({ ...comp }));
          const totalPrice = selectedComponents.reduce((sum, comp) => sum + (comp.preco || 0), 0);
          const newBuild: Build = {
            id: crypto.randomUUID(),
            nome: `Build IA para ${data.perfilPC?.purpose || data.perfilPC?.machineType || 'Uso Geral'}`,
            componentes: selectedComponents,
            orcamento: recommendation.estimatedTotalPrice !== undefined ? recommendation.estimatedTotalPrice : totalPrice,
            dataCriacao: new Date().toISOString(),
            requisitos: data, 
            avisosCompatibilidade: recommendation.compatibilityWarnings || []
          };
          setCurrentBuild(newBuild);
          setAiNotes(`${recommendation.justification}${recommendation.budgetNotes ? `\n\nNotas sobre o orçamento: ${recommendation.budgetNotes}` : ''}`);
        } else {
          setError('Não foi possível gerar uma recomendação. Tente ajustar seus requisitos ou tente novamente mais tarde.');
          setCurrentBuild(null);
        }
      })
      .catch(err => {
        setError(err.message || 'Ocorreu um erro ao contatar o serviço de IA. Por favor, tente novamente.');
        setCurrentBuild(null);
      })
      .finally(() => setIsLoading(false));
  }, [availableComponents]);

  const triggerSaveBuild = () => {
    if (!currentBuild) return;
    if (!currentUser) {
      sessionStorage.setItem(SESSION_PENDING_BUILD_KEY, JSON.stringify(currentBuild));
      if (aiNotes) sessionStorage.setItem(SESSION_PENDING_AI_NOTES_KEY, JSON.stringify(aiNotes));
      setPendingActionForAuth('save');
      setIsAuthInfoModalOpen(true);
    } else {
      executeActualSaveBuild(currentBuild);
    }
  };

  const triggerExportBuild = () => {
    if (!currentBuild) return;
    executeActualExportBuild(currentBuild, aiNotes);
  };
  
  const handleTryAgain = () => {
    resetBuildState();
    navigate('/build', { state: { newBuild: true }, replace: true });
  };

  const renderContent = () => {
    if (!availableComponents && !error) {
       return (
        <div className="text-center py-10">
          <LoadingSpinner size="lg" text={'Carregando componentes...'} />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="text-center py-10">
          <LoadingSpinner size="lg" text={isViewingSavedBuild ? 'Carregando sua build...' : 'IA está pensando na sua build...'} />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="my-6 p-6 bg-red-800/90 text-red-100 rounded-lg text-center shadow-xl">
          <h3 className="text-2xl font-semibold mb-3">Oops! Algo deu errado.</h3>
          <p className="mb-4">{error}</p>
          <Button onClick={handleTryAgain} variant="secondary" size="lg">
            Tentar Novamente
          </Button>
        </div>
      );
    }

    if (currentBuild) {
      return (
        <>
          <BuildSummary
              build={currentBuild}
              isLoading={isLoading} 
              onSaveBuild={triggerSaveBuild}
              onExportBuild={triggerExportBuild}
              aiRecommendationNotes={aiNotes}
            />
          <div className="mt-6 text-center">
            <Button
                onClick={() => navigate('/build', { state: { newBuild: true } })}
                variant="secondary"
                size="lg"
            >
                Iniciar Nova Montagem com IA
            </Button>
          </div>
        </>
      );
    }

    return <ChatbotAnamnesis onAnamnesisComplete={handleAnamnesisComplete} initialAnamnesisData={preferencias || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }} />;
  };

  return (
    <div className="container mx-auto p-4">
      {isAuthInfoModalOpen ? (
        <Modal
          isOpen={isAuthInfoModalOpen}
          onClose={pendingActionForAuth ? () => { setIsAuthInfoModalOpen(false); setPendingActionForAuth(null); } : handleContinueAnonymously}
          title={pendingActionForAuth ? "Login Necessário" : "Aviso: Montagem Anônima"}
          size="md"
        >
          <p className="text-neutral-dark mb-6">
            {pendingActionForAuth === 'save' && "Você precisa estar logado para salvar sua build. Faça login ou crie uma conta."}
            {!pendingActionForAuth && "Você pode iniciar a montagem do seu PC agora. No entanto, para salvar sua build, será necessário fazer login."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleLoginForBuild} variant="primary" className="flex-1">
              Fazer Login / Cadastrar
            </Button>
            {!pendingActionForAuth && ( 
                <Button onClick={handleContinueAnonymously} variant="secondary" className="flex-1">
                Continuar sem Login
                </Button>
            )}
             {pendingActionForAuth && ( 
                <Button onClick={() => { setIsAuthInfoModalOpen(false); setPendingActionForAuth(null); } } variant="ghost" className="flex-1">
                   Cancelar Ação
                </Button>
            )}
          </div>
        </Modal>
      ) : renderContent()}

      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Exportar Build" size="lg">
        <textarea
          readOnly
          value={exportedText}
          className="w-full h-64 p-3 bg-primary border border-neutral-dark rounded-md text-neutral text-xs whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Texto da Build Exportada"
        ></textarea>
        <div className="mt-4 flex gap-3">
            <Button 
                onClick={() => {
                    navigator.clipboard.writeText(exportedText)
                        .then(() => alert("Copiado para a área de transferência!"))
                        .catch(()=> alert("Falha ao copiar. Por favor, copie manualmente."));
                }}
                variant="primary"
                className="flex-1"
            >
                Copiar para Área de Transferência
            </Button>
            <Button 
                onClick={() => setIsExportModalOpen(false)} 
                variant="secondary"
                className="flex-1"
            >
                Fechar
            </Button>
        </div>
      </Modal>
    </div>
  );
};

export default BuildPage;

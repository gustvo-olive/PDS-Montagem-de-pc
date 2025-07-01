import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreferenciaUsuarioInput, Build, Componente, AIRecommendation, Ambiente, PerfilPCDetalhado } from '../types';
import ChatbotAnamnesis from '../components/build/ChatbotAnamnesis';
import BuildSummary from '../components/build/BuildSummary';
import LoadingSpinner from '../components/core/LoadingSpinner';
import Button from '../components/core/Button';
import { getBuildRecommendation } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/core/Modal';
import { supabase } from '../services/supabaseClient';
import { getComponents } from '../services/componentService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


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
  const [isViewingSavedBuild, setIsViewingSavedBuild] = useState<boolean>(false);
  const [availableComponents, setAvailableComponents] = useState<Componente[] | null>(null);

  const [isAuthInfoModalOpen, setIsAuthInfoModalOpen] = useState<boolean>(false);
  const [pendingActionForAuth, setPendingActionForAuth] = useState<'save' | 'export' | null>(null);
  const hasProceededAnonymously = useRef<boolean>(sessionStorage.getItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY) === 'true');

  useEffect(() => {
    const fetchComponents = async () => {
        const components = await getComponents();
        if (components.length > 0) {
            setAvailableComponents(components);
        } else {
            setError("Não foi possível carregar os componentes disponíveis. A montagem IA está desabilitada.");
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
    const { error: deleteError } = await supabase.from('build_components').delete().eq('build_id', buildToSave.id);
    if (deleteError) console.error("Error clearing old components:", deleteError);
    const buildComponentsPayload = buildToSave.componentes.map(comp => ({ build_id: buildToSave.id, component_id: comp.id }));
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
    const doc = new jsPDF();

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(`Resumo da Build: ${buildToExport.nome}`, 14, 22);

    // Sub-detalhes
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Data: ${new Date(buildToExport.dataCriacao).toLocaleDateString()}`, 14, 30);
    doc.text(`Preço Total Estimado: R$ ${buildToExport.orcamento.toFixed(2)}`, 14, 36);
    
    let startY = 45;

    // Notas da IA
    if (notesForExport) {
        doc.setFont('helvetica', 'bold');
        doc.text('Notas da IA:', 14, startY);
        startY += 7;
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(notesForExport, 180);
        doc.text(splitNotes, 14, startY);
        startY += (splitNotes.length * 5) + 5;
    }

    // Tabela de Componentes
    const head = [['Produto', 'Preço', 'Link']];
    const body = buildToExport.componentes.map(c => [
        c.Produto,
        `R$ ${c.Preco.toFixed(2)}`,
        c.LinkCompra || 'N/A'
    ]);

    autoTable(doc, {
        head: head,
        body: body,
        startY: startY,
        headStyles: { fillColor: [13, 27, 42] }, // Cor primária
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: function (data: any) {
            if (data.section === 'body' && data.column.index === 2) {
                const url = data.cell.raw as string;
                if (url && url.startsWith('http')) {
                    data.cell.text = ['Ver Oferta'];
                }
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 2) {
                const url = data.cell.raw as string;
                if (url && url.startsWith('http')) {
                    doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: url });
                }
            }
        },
        margin: { left: 14, right: 14 }
    });

    // Salva o PDF
    const fileName = `${buildToExport.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
  }, []); 

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
        const allComponents = await getComponents();
        if(allComponents.length === 0) {
            setError("Falha ao carregar dados de componentes para exibir a build salva.");
            setIsLoading(false);
            return;
        }
        
        const { data, error } = await supabase.from('builds').select('*, build_components(component_id)').eq('id', buildId).single();
        if (error) {
          setError(`A build com o ID '${buildId}' não foi encontrada ou você não tem permissão para vê-la.`);
          resetBuildState();
        } else if (data) {
          const componentMap = new Map(allComponents.map(c => [c.id, c]));
          // @ts-ignore
          const components = data.build_components.map(bc => componentMap.get(String(bc.component_id))).filter(Boolean);
          const formattedBuild: Build = {
            id: data.id, nome: data.nome, orcamento: data.orcamento, dataCriacao: data.data_criacao,
            avisosCompatibilidade: data.avisos_compatibilidade || [],
            requisitos: data.requisitos as PreferenciaUsuarioInput || undefined,
            componentes: components as Componente[], userId: data.user_id,
          };
          setCurrentBuild(formattedBuild);
          setPreferencias(formattedBuild.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
          setAiNotes(undefined); setError(null); setIsViewingSavedBuild(true);
        }
        setIsLoading(false);
      };
      fetchSavedBuild();
    }
  }, [location.pathname, location.state, currentBuild?.id, resetBuildState, navigate]);

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const buildIdFromPath = pathParts.length > 2 && pathParts[1] === 'build' ? pathParts[2] : null;
    if (!currentUser && !buildIdFromPath && !hasProceededAnonymously.current && !preferencias && !currentBuild && !isLoading && !error && !pendingActionForAuth && !sessionStorage.getItem(SESSION_PENDING_BUILD_KEY)) {
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
            setCurrentBuild(buildToProcess);
            setPreferencias(buildToProcess.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
            setAiNotes(notesToProcess);
            setError(null); setIsLoading(false);
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
  
  const handleAnamnesisComplete = useCallback(async (data: PreferenciaUsuarioInput) => {
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

    try {
        const recommendation: AIRecommendation | null = await getBuildRecommendation(data, availableComponents);
        
        if (recommendation && recommendation.recommendedComponentIds) {
            const componentMap = new Map(availableComponents.map(c => [c.id, c]));
            const recommendedComponents = recommendation.recommendedComponentIds
                .map(id => componentMap.get(id))
                .filter((c): c is Componente => c !== undefined);

            if (recommendedComponents.length !== recommendation.recommendedComponentIds.length) {
                console.warn("Some recommended component IDs were not found in the available components list.");
            }

            const newBuild: Build = {
                id: crypto.randomUUID(),
                nome: `Build IA - ${data.perfilPC.purpose || 'Custom'}`,
                componentes: recommendedComponents,
                orcamento: recommendation.estimatedTotalPrice || recommendedComponents.reduce((acc, c) => acc + c.Preco, 0),
                dataCriacao: new Date().toISOString(),
                requisitos: data,
                avisosCompatibilidade: recommendation.compatibilityWarnings || [],
            };

            setCurrentBuild(newBuild);
            setAiNotes(`${recommendation.justification}\n\nNotas do Orçamento: ${recommendation.budgetNotes || 'N/A'}`);
        } else {
            setError("A IA não conseguiu gerar uma recomendação. Por favor, tente ajustar seus requisitos ou tente novamente mais tarde.");
        }
    } catch (e: any) {
        setError(`Erro ao gerar recomendação da IA: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
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
       return <div className="text-center py-10"><LoadingSpinner size="lg" text={'Carregando componentes...'} /></div>;
    }

    if (isLoading) {
      return (
        <div className="text-center py-10">
          <LoadingSpinner size="lg" text={isViewingSavedBuild ? 'Carregando sua build...' : 'Gerando sua build com a IA...'} />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="my-6 p-6 bg-red-800/90 text-red-100 rounded-lg text-center shadow-xl">
          <h3 className="text-2xl font-semibold mb-3">Oops! Algo deu errado.</h3>
          <p className="mb-4">{error}</p>
          <Button onClick={handleTryAgain} variant="secondary" size="lg">Tentar Novamente</Button>
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
            <Button onClick={() => navigate('/build', { state: { newBuild: true } })} variant="secondary" size="lg">
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
            <Button onClick={handleLoginForBuild} variant="primary" className="flex-1">Fazer Login</Button>
            {!pendingActionForAuth && (<Button onClick={handleContinueAnonymously} variant="secondary" className="flex-1">Continuar sem Login</Button>)}
             {pendingActionForAuth && (<Button onClick={() => { setIsAuthInfoModalOpen(false); setPendingActionForAuth(null); } } variant="ghost" className="flex-1">Cancelar Ação</Button>)}
          </div>
        </Modal>
      ) : renderContent()}
    </div>
  );
};

export default BuildPage;
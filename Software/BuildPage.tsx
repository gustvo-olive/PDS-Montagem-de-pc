
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreferenciaUsuarioInput, Build, Componente, SelectedComponent, AIRecommendation, Ambiente, PerfilPCDetalhado } from '../types'; // Changed AnamnesisData to PreferenciaUsuarioInput, PCComponent to Componente
import ChatbotAnamnesis from '../components/build/ChatbotAnamnesis';
import BuildSummary from '../components/build/BuildSummary';
import LoadingSpinner from '../components/core/LoadingSpinner';
import Button from '../components/core/Button';
import { getBuildRecommendation } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/core/Modal';

const SESSION_PENDING_BUILD_KEY = 'pendingBuild';
const SESSION_PENDING_AI_NOTES_KEY = 'pendingAiNotes';
const SESSION_PROCEEDED_ANONYMOUSLY_KEY = 'proceededAnonymously';

const BuildPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput | null>(null); // Changed from anamnesisData
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState<string | undefined>(undefined);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportedText, setExportedText] = useState<string>('');

  const [isAuthInfoModalOpen, setIsAuthInfoModalOpen] = useState<boolean>(false);
  const [pendingActionForAuth, setPendingActionForAuth] = useState<'save' | 'export' | null>(null);
  const hasProceededAnonymously = useRef<boolean>(sessionStorage.getItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY) === 'true');


  const executeActualSaveBuild = useCallback((buildToSave: Build) => {
    if (!currentUser) {
      console.error("Attempted to save build without a logged-in user. This should not happen if logic is correct.");
      alert("Erro: Usuário não está logado para salvar. Por favor, faça login ou cadastre-se e tente novamente.");
      setPendingActionForAuth(null); 
      sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
      sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
      setIsAuthInfoModalOpen(true); 
      return;
    }
    const savedBuildsStr = localStorage.getItem(`savedBuilds_${currentUser.id}`);
    const savedBuilds: Build[] = savedBuildsStr ? JSON.parse(savedBuildsStr) : [];
    
    const buildWithUserId = { ...buildToSave, userId: currentUser.id };

    const existingBuildIndex = savedBuilds.findIndex(b => b.id === buildWithUserId.id);

    if (existingBuildIndex > -1) {
        savedBuilds[existingBuildIndex] = buildWithUserId;
    } else {
        savedBuilds.push(buildWithUserId);
    }
    localStorage.setItem(`savedBuilds_${currentUser.id}`, JSON.stringify(savedBuilds));
    alert(`Build "${buildToSave.nome}" salva com sucesso em seu perfil!`); // Changed buildToSave.name to buildToSave.nome
  }, [currentUser]);

  const executeActualExportBuild = useCallback((buildToExport: Build, notesForExport?: string) => {
    let text = `Build: ${buildToExport.nome}\n`; // Changed buildToExport.name to buildToExport.nome
    text += `Data: ${new Date(buildToExport.dataCriacao).toLocaleDateString()}\n`; // Changed buildToExport.createdAt to buildToExport.dataCriacao
    text += `Preço Total Estimado: R$ ${buildToExport.orcamento.toFixed(2)}\n\n`; // Changed buildToExport.totalPrice to buildToExport.orcamento
    text += `Componentes:\n`;
    buildToExport.componentes.forEach(c => { // Changed buildToExport.components to buildToExport.componentes
      text += `- ${c.tipo}: ${c.nome} (${c.brand}) - R$ ${c.preco.toFixed(2)}\n`;
    });
    if(buildToExport.requisitos){ // Changed buildToExport.requirements to buildToExport.requisitos
      text += `\nRequisitos:\n`;
      Object.entries(buildToExport.requisitos).forEach(([key, value]) => { // Changed buildToExport.requirements to buildToExport.requisitos
        if(value !== undefined && value !== null && value !== '') {
            let displayValue = String(value);
            if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
            
            let keyToTest = key.toLowerCase();
            if ((keyToTest.includes('temp') || keyToTest.includes('temperatura') || keyToTest === 'cityavgtemp' || keyToTest === 'citymaxtemp' || keyToTest === 'citymintemp') && typeof value === 'number') displayValue = `${value.toFixed(0)}°C`;
            else if (key === 'orcamento' && typeof value === 'number') displayValue = `R$ ${value.toFixed(2)}`;
            
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            text += `- ${displayKey}: ${displayValue}\n`;
        }
      });
    }
    if(notesForExport) text += `\nNotas da IA:\n${notesForExport}\n`;
    if(buildToExport.avisosCompatibilidade && buildToExport.avisosCompatibilidade.length > 0){ // Changed buildToExport.compatibilityIssues to buildToExport.avisosCompatibilidade
      text += `\nAvisos de Compatibilidade:\n`;
      buildToExport.avisosCompatibilidade.forEach(issue => text += `- ${issue}\n`); // Changed buildToExport.compatibilityIssues to buildToExport.avisosCompatibilidade
    }
    setExportedText(text);
    setIsExportModalOpen(true);
  }, []); 

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const buildIdFromPath = pathParts.length > 2 && pathParts[1] === 'build' ? pathParts[2] : null;
    
    if (
      !currentUser &&
      !buildIdFromPath &&
      !hasProceededAnonymously.current &&
      !preferencias && 
      !currentBuild &&
      !isLoading &&
      !error &&
      !pendingActionForAuth &&
      !sessionStorage.getItem(SESSION_PENDING_BUILD_KEY) 
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
            
            setCurrentBuild(buildToProcess);
            setPreferencias(buildToProcess.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }); // Changed buildToProcess.requirements
            setAiNotes(notesToProcess);
            setError(null);
            setIsLoading(false); 

            const timerId = setTimeout(() => {
                if (action === 'save') {
                    executeActualSaveBuild(buildToProcess);
                } else if (action === 'export') {
                    executeActualExportBuild(buildToProcess, notesToProcess);
                }
            }, 0); 
            
            sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
            sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
            setPendingActionForAuth(null);
            navigate(location.pathname, { state: {}, replace: true });

            return () => clearTimeout(timerId);
        } catch (e) {
            console.error("Error processing pending build from session storage:", e);
            setError("Erro ao processar build pendente. Tente novamente.");
            sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
            sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
            setPendingActionForAuth(null);
            navigate(location.pathname, { state: {}, replace: true });
        }
      } else {
        setPendingActionForAuth(null);
        navigate(location.pathname, { state: {}, replace: true });
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
  
  const handleAnamnesisComplete = useCallback((data: PreferenciaUsuarioInput) => { // Changed AnamnesisData to PreferenciaUsuarioInput
    setPreferencias(data); 
    setIsLoading(true);
    setError(null);
    setAiNotes(undefined);
    setCurrentBuild(null); 
    
    // This file is obsolete and does not have access to the component database.
    // Using an empty array to fix the build error. The active component is /pages/BuildPage.tsx.
    const componentesDisponiveis: Componente[] = [];

    getBuildRecommendation(data, componentesDisponiveis)
      .then(recommendation => {
        if (recommendation) {
          const recommendedCompDetails: Componente[] = componentesDisponiveis.filter(c => recommendation.recommendedComponentIds.includes(c.id));
          
          const selectedComponents: SelectedComponent[] = recommendedCompDetails.map(comp => {
            // comp is already a full Componente object from MOCK_COMPONENTS
            return {
                ...comp, // Spread all properties from Componente
            } as SelectedComponent; // SelectedComponent extends Componente
          });

          const totalPrice = selectedComponents.reduce((sum, comp) => sum + comp.preco, 0); // Changed comp.price to comp.preco

          const newBuild: Build = {
            id: Date.now().toString(),
            nome: `Build IA para ${data.perfilPC?.purpose || data.perfilPC?.machineType || 'Uso Geral'}`, // Changed name to nome
            componentes: selectedComponents, // Changed components to componentes
            orcamento: recommendation.estimatedTotalPrice !== undefined ? recommendation.estimatedTotalPrice : totalPrice, // Changed totalPrice to orcamento
            dataCriacao: new Date().toISOString(), // Changed createdAt to dataCriacao
            requisitos: data,  // Changed requirements to requisitos
            avisosCompatibilidade: recommendation.compatibilityWarnings || [] // Changed compatibilityIssues to avisosCompatibilidade
          };
          setCurrentBuild(newBuild);
          setAiNotes(`${recommendation.justification}${recommendation.budgetNotes ? `\n\nNotas sobre o orçamento: ${recommendation.budgetNotes}` : ''}`);
        } else {
          setError('Não foi possível gerar uma recomendação. Tente ajustar seus requisitos ou tente novamente mais tarde.');
          setCurrentBuild(null);
        }
      })
      .catch(err => {
        console.error("Error fetching build recommendation:", err);
        setError('Ocorreu um erro ao contatar o serviço de IA. Por favor, tente novamente.');
        setCurrentBuild(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const triggerSaveBuild = () => {
    if (!currentBuild) return;
    if (!currentUser) {
      sessionStorage.setItem(SESSION_PENDING_BUILD_KEY, JSON.stringify(currentBuild));
      if (aiNotes) sessionStorage.setItem(SESSION_PENDING_AI_NOTES_KEY, JSON.stringify(aiNotes));
      else sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
      
      setPendingActionForAuth('save');
      setIsAuthInfoModalOpen(true);
    } else {
      executeActualSaveBuild(currentBuild);
    }
  };

  const triggerExportBuild = () => {
    if (!currentBuild) return;
    if (!currentUser) {
      sessionStorage.setItem(SESSION_PENDING_BUILD_KEY, JSON.stringify(currentBuild));
      if (aiNotes) sessionStorage.setItem(SESSION_PENDING_AI_NOTES_KEY, JSON.stringify(aiNotes));
      else sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);

      setPendingActionForAuth('export');
      setIsAuthInfoModalOpen(true);
    } else {
      executeActualExportBuild(currentBuild, aiNotes);
    }
  };
  
  const handleTryAgain = () => {
    setError(null);
    setCurrentBuild(null);
    setAiNotes(undefined);
    setPendingActionForAuth(null);
    sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
    sessionStorage.removeItem(SESSION_PENDING_AI_NOTES_KEY);
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
            {pendingActionForAuth === 'export' && "Você precisa estar logado para exportar sua build. Faça login ou crie uma conta."}
            {!pendingActionForAuth && "Você pode iniciar a montagem do seu PC agora. No entanto, para salvar ou exportar sua build, será necessário fazer login."}
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
      ) : (
        <>
          {!currentBuild && !isLoading && !error && (
            <ChatbotAnamnesis onAnamnesisComplete={handleAnamnesisComplete} initialAnamnesisData={preferencias || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }} />
          )}

          {isLoading && (
            <div className="text-center py-10">
              <LoadingSpinner size="lg" text={'IA está pensando na sua build...'} />
            </div>
          )}

          {error && !isLoading && (
            <div className="my-6 p-6 bg-red-800/90 text-red-100 rounded-lg text-center shadow-xl">
              <h3 className="text-2xl font-semibold mb-3">Oops! Algo deu errado.</h3>
              <p className="mb-4">{error}</p>
              <Button onClick={handleTryAgain} variant="secondary" size="lg">
                Tentar Novamente com a IA
              </Button>
            </div>
          )}
          
          {!isLoading && !error && currentBuild && (
            <BuildSummary
                build={currentBuild}
                isLoading={isLoading} 
                onSaveBuild={triggerSaveBuild}
                onExportBuild={triggerExportBuild}
                aiRecommendationNotes={aiNotes}
              />
          )}
        </>
      )}

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

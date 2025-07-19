/**
 * @file Página de Montagem (BuildPage).
 * @module pages/BuildPage
 * @description Este é o componente principal que orquestra todo o fluxo de montagem de um PC.
 * Ele gerencia o estado da build, a interação com o chatbot, a exibição do resumo,
 * o carregamento de builds salvas, e o fluxo de autenticação para salvar/exportar.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PreferenciaUsuarioInput, Build, Componente, AIRecommendation, Ambiente, PerfilPCDetalhado, Json } from '../types';
import ChatbotAnamnesis from '../components/build/ChatbotAnamnesis';
import BuildSummary from '../components/build/BuildSummary';
import LoadingSpinner from '../components/core/LoadingSpinner';
import Button from '../components/core/Button';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/core/Modal';
import { supabase } from '../services/supabaseClient';
import { getComponents } from '../services/componentService';
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
  const [preferencias, setPreferencias] = useState<PreferenciaUsuarioInput | null>(null);
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewingSavedBuild, setIsViewingSavedBuild] = useState<boolean>(false);
  const [availableComponents, setAvailableComponents] = useState<Componente[] | null>(null);
  const [pageInitialized, setPageInitialized] = useState<boolean>(false);
  const [isBuildComplete, setIsBuildComplete] = useState<boolean>(false);

  // Estados para gerenciar o fluxo de autenticação para usuários anônimos.
  const [isAuthInfoModalOpen, setIsAuthInfoModalOpen] = useState<boolean>(false);
  const [pendingActionForAuth, setPendingActionForAuth] = useState<'save' | 'export' | null>(null);
  const hasProceededAnonymously = useRef<boolean>(sessionStorage.getItem(SESSION_PROCEEDED_ANONYMOUSLY_KEY) === 'true');

  // Efeito para carregar a lista de componentes disponíveis na montagem do componente.
  // Isso é necessário para a IA ter a lista de peças para escolher.
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
    setCurrentBuild(null);
    setPreferencias(null);
    setError(null);
    setIsViewingSavedBuild(false);
    setPageInitialized(false);
    setIsBuildComplete(false);
    sessionStorage.removeItem(SESSION_PENDING_BUILD_KEY);
    sessionStorage.removeItem(SESSION_PENDING_PREFERENCIAS_KEY);
    setPendingActionForAuth(null);
    navigate('/build', { replace: true, state: { newBuild: true, timestamp: Date.now() } });
  }, [navigate]);

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
        // Simplificação do processo de salvar:
        // Para garantir que o salvamento seja rápido e confiável, mesmo após longas conversas com a IA,
        // nós limpamos e compactamos o objeto de "requisitos" antes de enviá-lo.
        // Isso remove dados desnecessários ou excessivamente grandes que podem causar lentidão ou falhas.
        const sanitizedRequisitos = ((prefs: PreferenciaUsuarioInput | undefined): Json | null => {
            if (!prefs) return null;

            // Mantemos apenas as propriedades essenciais para recriar o contexto da build,
            // descartando dados transitórios da conversa.
            const cleanPrefs: Partial<PreferenciaUsuarioInput> = {
                orcamento: prefs.orcamento,
                orcamentoRange: prefs.orcamentoRange,
                perfilPC: prefs.perfilPC || {},
                ambiente: prefs.ambiente || {},
                ownedComponents: prefs.ownedComponents,
                buildExperience: prefs.buildExperience,
                brandPreference: prefs.brandPreference,
                aestheticsImportance: prefs.aestheticsImportance,
                caseSize: prefs.caseSize,
                noiseLevel: prefs.noiseLevel,
                specificPorts: prefs.specificPorts,
                // O campo de preferências gerais é truncado para evitar sobrecarga.
                preferences: prefs.preferences ? String(prefs.preferences).substring(0, 2000) : undefined,
            };
            
            // Removemos chaves com valores `undefined` para gerar um JSON final mais enxuto.
            Object.keys(cleanPrefs).forEach(key => {
                const k = key as keyof Partial<PreferenciaUsuarioInput>;
                if (cleanPrefs[k] === undefined) {
                    delete cleanPrefs[k];
                }
            });

            // A conversão final para string e de volta para JSON garante um objeto 100% serializável.
            return JSON.parse(JSON.stringify(cleanPrefs));
        })(buildToSave.requisitos);

        const { error: rpcError } = await supabase.rpc('upsert_build_with_components', {
            p_build_id: buildToSave.id,
            p_nome: buildToSave.nome,
            p_orcamento: buildToSave.orcamento,
            p_data_criacao: buildToSave.dataCriacao,
            p_requisitos: sanitizedRequisitos,
            p_avisos_compatibilidade: buildToSave.avisos_compatibilidade || [],
            p_component_ids: buildToSave.componentes.map(c => c.id)
        });

        if (rpcError) throw rpcError;

        toast.success(`Build "${buildToSave.nome}" salva com sucesso!`);
        setCurrentBuild(buildToSave);
        setIsViewingSavedBuild(true);
        navigate(`/build/${buildToSave.id}`, { replace: true });

    } catch (error: any) {
        console.error("Save build raw error object:", error);
        
        let fullMessage;
        if (error && typeof error === 'object' && error.message) {
            const message = error.message;
            const details = error.details ? `\nDetalhes: ${error.details}` : '';
            const hint = error.hint ? `\nDica: ${error.hint}` : '';
            fullMessage = `Falha ao salvar a build: ${message}${details}${hint}`;
        } else {
            let technicalDetails = '';
            try {
                const detailsString = JSON.stringify(error);
                if (detailsString !== '{}') technicalDetails = `Detalhes técnicos: ${detailsString}`;
            } catch (e) {
                technicalDetails = 'Não foi possível obter os detalhes do erro.';
            }
            fullMessage = `Ocorreu um erro inesperado ao salvar. ${technicalDetails}`.trim();
        }
        setError(fullMessage);
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

    if (location.state?.newBuild && !pageInitialized) {
        resetBuildState();
        setPageInitialized(true);
        return;
    }
    
    if (buildId) {
        if ((isViewingSavedBuild && currentBuild?.id === buildId)) return;
      
        setIsLoading(true);
        const fetchSavedBuild = async () => {
            // A consulta relacional complexa pode causar o erro "Type instantiation is excessively deep".
            // Para contornar isso, tipamos a promessa da consulta como 'any' para evitar que o TypeScript
            // tente inferir o tipo complexo, que é a fonte do erro.
            const { data, error: fetchError } = await (supabase
                .from('builds')
                .select('*, build_components(components(*))')
                .eq('id', buildId)
                .single()) as any;

            if (fetchError) {
                setError(`A build com o ID '${buildId}' não foi encontrada.`);
                resetBuildState();
            } else if (data) {
                // Mapeia a resposta aninhada do Supabase para o nosso tipo `Build`.
                const components: Componente[] = (data.build_components as any[])
                    .map(bc => bc.components)
                    .filter(Boolean) as Componente[];
                
                const warnings = data.avisos_compatibilidade || [];
                const justificationFromDb = warnings.length > 0
                    ? `Avisos de Compatibilidade:\n${warnings.map(w => `- ${w}`).join('\n')}`
                    : undefined;

                const formattedBuild: Build = {
                    id: data.id, nome: data.nome, orcamento: data.orcamento, dataCriacao: data.data_criacao,
                    justificativa: justificationFromDb,
                    avisos_compatibilidade: warnings,
                    requisitos: data.requisitos as PreferenciaUsuarioInput || undefined,
                    componentes: components, userId: data.user_id,
                };
                setCurrentBuild(formattedBuild);
                setPreferencias(formattedBuild.requisitos || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente });
                setIsViewingSavedBuild(true);
                setIsBuildComplete(true);
            }
            setIsLoading(false);
        };
        fetchSavedBuild();
    }
  }, [location.pathname, location.state, currentBuild?.id, isViewingSavedBuild, resetBuildState, navigate, pageInitialized]);

  // Efeito para gerenciar a lógica de autenticação pós-ação (ex: salvar build após login).
  useEffect(() => {
    if (!currentUser && !location.pathname.includes('/build/') && !hasProceededAnonymously.current && !currentBuild && !isLoading && availableComponents) {
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
  }, [currentUser, location, navigate, currentBuild, isLoading, executeActualSaveBuild, executeActualExportBuild, availableComponents]);

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
   * Callback para receber atualizações da build.
   * @param buildUpdate - O objeto parcial da build com dados atualizados pela IA.
   * @param finalPreferences - As preferências do usuário atualizadas.
   * @private
   */
  const handleBuildUpdate = useCallback((buildUpdate: Partial<Build>, finalPreferences: PreferenciaUsuarioInput) => {
    setCurrentBuild(prevBuild => {
        const baseBuild = prevBuild || {
            id: crypto.randomUUID(),
            dataCriacao: new Date().toISOString(),
            nome: 'Nova Build',
            componentes: [],
            orcamento: 0,
        };

        const justificationText = buildUpdate.justificativa || baseBuild.justificativa || '';
        const warningsRegex = /Avisos de Compatibilidade:([\s\S]*)/i;
        const warningsMatch = justificationText.match(warningsRegex);
        const warningsText = warningsMatch ? warningsMatch[1].trim() : '';
        const warnings = warningsText ? warningsText.split('\n').map(w => w.replace(/^- /, '').trim()).filter(Boolean) : [];

        const updatedBuild: Build = {
            ...baseBuild,
            ...buildUpdate,
            requisitos: finalPreferences,
            avisos_compatibilidade: warnings,
        };
        
        setIsBuildComplete(!!updatedBuild.componentes && updatedBuild.componentes.length > 0);
        return updatedBuild;
    });
    setPreferencias(finalPreferences);
  }, []);

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
    if (isLoading && !availableComponents) {
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
              <BuildSummary build={currentBuild} onExportBuild={triggerExportBuild} aiRecommendationNotes={aiNotesToDisplay} />
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
              key={location.state?.timestamp || 'chat-init'} 
              onBuildUpdate={handleBuildUpdate}
              availableComponents={availableComponents}
              initialAnamnesisData={preferencias || { perfilPC: {} as PerfilPCDetalhado, ambiente: {} as Ambiente }}
            />
        </div>
        <div className="lg:col-span-2 mt-8 lg:mt-0">
            <div className="sticky top-24">
              <BuildSummary 
                  build={currentBuild} 
                  isLoading={false} 
                  onSaveBuild={isBuildComplete && currentBuild ? triggerSaveBuild : undefined}
                  isSaving={isSaving}
                  onExportBuild={isBuildComplete && currentBuild ? triggerExportBuild : undefined}
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
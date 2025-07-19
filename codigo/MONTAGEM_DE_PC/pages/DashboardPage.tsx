/**
 * @file Página do Painel do Usuário (DashboardPage).
 * @module pages/DashboardPage
 * @description Esta é uma rota protegida que serve como o painel principal para usuários autenticados.
 * Ela exibe uma saudação, ações rápidas e uma lista de todas as builds de PC que o usuário salvou.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Build, Componente, PreferenciaUsuarioInput } from '../types';
import Button from '../components/core/Button';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { supabase } from '../services/supabaseClient';
import toast from 'react-hot-toast';

/**
 * @component SavedBuildCard
 * @description Um card de UI que exibe um resumo de uma build salva e fornece
 * ações como "Ver/Editar" e "Excluir".
 * @param {{ build: Build; onDelete: (buildId: string) => void }} props - As propriedades do componente.
 * @private
 * @returns {React.ReactElement} Um card representando uma build salva.
 */
const SavedBuildCard: React.FC<{ build: Build; onDelete: (buildId: string) => void }> = ({ build, onDelete }) => {
  return (
    <div className="bg-primary p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <div className="flex-grow">
        <h3 className="text-xl font-semibold text-accent mb-2">{build.nome}</h3>
        <p className="text-sm text-neutral-dark mb-1">Criada em: {new Date(build.dataCriacao).toLocaleDateString()}</p>
        <p className="text-sm text-neutral-dark mb-1">Componentes: {build.componentes.length}</p>
        <p className="text-lg font-medium text-neutral mb-4">Total: R$ {build.orcamento.toFixed(2)}</p>
      </div>
      <div className="flex space-x-2 mt-auto">
        <Link to={`/build/${build.id}`}> 
          <Button size="sm" variant="ghost">Ver/Editar</Button>
        </Link>
        <Button size="sm" variant="danger" onClick={() => onDelete(build.id)}>Excluir</Button>
      </div>
    </div>
  );
};

/**
 * @component DashboardPage
 * @description A página de painel do usuário. Busca e exibe as builds salvas
 * do usuário a partir do Supabase e permite que ele as gerencie (visualize, edite ou exclua).
 * Esta é uma rota protegida e só é acessível para usuários autenticados.
 * @returns {React.ReactElement} A página do painel do usuário.
 */
const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [savedBuilds, setSavedBuilds] = useState<Build[]>([]);
  const [isLoadingBuilds, setIsLoadingBuilds] = useState(true);

  /**
   * Busca as builds salvas do usuário logado no Supabase.
   * Utiliza uma consulta relacional para buscar as builds e todos os detalhes
   * de seus componentes de forma eficiente em uma única chamada.
   * @private
   */
  const fetchBuilds = useCallback(async () => {
    if (!currentUser) return;

    setIsLoadingBuilds(true);
    
    // To work around the "Type instantiation is excessively deep" error, we avoid
    // direct destructuring. Instead, we assign the result to a variable explicitly
    // typed as `any` to halt TypeScript's problematic deep type inference.
    const response: any = await supabase
      .from('builds')
      .select(`
        id,
        nome,
        orcamento,
        data_criacao,
        requisitos,
        avisos_compatibilidade,
        user_id,
        build_components (
          components (*)
        )
      `)
      .eq('user_id', currentUser.id)
      .order('data_criacao', { ascending: false });

    const { data, error } = response;

    if (error) {
      toast.error(`Não foi possível carregar suas builds: ${error.message}`);
    } else if (data) {
       const formattedBuilds: Build[] = data.map((build: any) => {
        // Mapeia a estrutura aninhada retornada pelo Supabase para nosso tipo `Build`.
        const components: Componente[] = build.build_components
            .map((bc: any) => bc.components)
            .filter(Boolean) as Componente[];
        
        const warnings = build.avisos_compatibilidade || [];
        const justificationFromDb = warnings.length > 0
            ? `Avisos de Compatibilidade:\n${warnings.map((w: string) => `- ${w}`).join('\n')}`
            : undefined;

        return {
          id: build.id,
          nome: build.nome,
          userId: build.user_id,
          componentes: components,
          orcamento: build.orcamento,
          dataCriacao: build.data_criacao,
          requisitos: build.requisitos as PreferenciaUsuarioInput | undefined,
          justificativa: justificationFromDb,
          avisos_compatibilidade: warnings,
        };
      });
      setSavedBuilds(formattedBuilds);
    }
    setIsLoadingBuilds(false);
  }, [currentUser]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

  /**
   * Deleta uma build do banco de dados após a confirmação do usuário.
   * Utiliza uma chamada RPC para garantir que a exclusão em cascata seja tratada corretamente
   * pelas políticas de segurança do Supabase.
   * @param {string} buildId - O ID da build a ser excluída.
   * @private
   */
  const handleDeleteBuild = async (buildId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Tem certeza que deseja excluir esta build? Esta ação não pode ser desfeita.")) {
      return;
    }
    
    const toastId = toast.loading('Excluindo build...');
    try {
      const { error } = await supabase.rpc('delete_build', { p_build_id: buildId });
  
      if (error) throw error;
  
      setSavedBuilds(prevBuilds => prevBuilds.filter(b => b.id !== buildId));
      toast.success("Build excluída com sucesso!", { id: toastId });
      
    } catch (error: any) {
      toast.error(`Falha ao excluir a build: ${error.message}`, { id: toastId });
      console.error("Erro ao excluir build:", error);
    }
  };


  if (!currentUser) {
    return <div className="text-center p-8"><p>Por favor, faça login para ver seu painel.</p></div>;
  }

  return (
    <div className="container mx-auto p-4">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-accent mb-2">Bem-vindo, {currentUser.nome}!</h1>
        <p className="text-lg text-neutral-dark">Gerencie suas montagens e explore novas possibilidades.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-neutral mb-6 pb-2 border-b border-neutral-dark/30">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/build" state={{ newBuild: true }} className="block bg-secondary p-6 rounded-lg shadow-lg hover:bg-opacity-80 transition-colors text-center">
            <div className="text-5xl mb-3 text-accent">🖥️</div>
            <h3 className="text-xl font-semibold text-neutral">Iniciar Nova Montagem</h3>
            <p className="text-sm text-neutral-dark mt-1">Use nossa IA ou monte manualmente.</p>
          </Link>
          <Link to="/profile" className="block bg-secondary p-6 rounded-lg shadow-lg hover:bg-opacity-80 transition-colors text-center">
             <div className="text-5xl mb-3 text-accent">👤</div>
            <h3 className="text-xl font-semibold text-neutral">Meu Perfil</h3>
            <p className="text-sm text-neutral-dark mt-1">Veja e edite suas informações.</p>
          </Link>
           <div className="bg-secondary p-6 rounded-lg shadow-lg text-center opacity-50 cursor-not-allowed">
             <div className="text-5xl mb-3 text-accent">💡</div>
            <h3 className="text-xl font-semibold text-neutral">Dicas e Recomendações</h3>
            <p className="text-sm text-neutral-dark mt-1">(Em breve)</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-neutral mb-6 pb-2 border-b border-neutral-dark/30">Minhas Builds Salvas</h2>
        {isLoadingBuilds ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner text="Carregando suas builds..." />
          </div>
        ) : savedBuilds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedBuilds.map(build => (
              <SavedBuildCard key={build.id} build={build} onDelete={handleDeleteBuild} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-primary/50 rounded-lg">
            <p className="text-xl text-neutral-dark">Você ainda não tem nenhuma build salva.</p>
            <Link to="/build" state={{ newBuild: true }}>
              <Button variant="primary" className="mt-4">Comece a Montar Agora</Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
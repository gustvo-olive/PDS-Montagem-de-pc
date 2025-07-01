import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Build, Componente, PreferenciaUsuarioInput } from '../types';
import Button from '../components/core/Button';
import LoadingSpinner from '../components/core/LoadingSpinner';
import { supabase } from '../services/supabaseClient';
import { getComponents } from '../services/componentService';

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
          <Button size="sm" variant="ghost">Visualizar</Button>
        </Link>
        <Button size="sm" variant="danger" onClick={() => onDelete(build.id)}>Excluir</Button>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [savedBuilds, setSavedBuilds] = useState<Build[]>([]);
  const [isLoadingBuilds, setIsLoadingBuilds] = useState(true);

  const fetchBuilds = useCallback(async () => {
    if (!currentUser) return;

    setIsLoadingBuilds(true);
    
    const allComponents = await getComponents();
    if (allComponents.length === 0) {
      console.error("Failed to load components from CSV for dashboard.");
      alert("Não foi possível carregar os dados dos componentes.");
      setIsLoadingBuilds(false);
      return;
    }
    const componentMap = new Map(allComponents.map(c => [c.id, c]));

    const { data, error } = await supabase
      .from('builds')
      .select(`
        *,
        build_components(
          component_id
        )
      `)
      .eq('user_id', currentUser.id)
      .order('data_criacao', { ascending: false });

    if (error) {
      console.error("Error fetching builds:", error);
      alert(`Não foi possível carregar suas builds: ${error.message}`);
    } else if (data) {
       const formattedBuilds: Build[] = data.map(build => {
        // @ts-ignore
        const components = build.build_components.map(bc => componentMap.get(String(bc.component_id))).filter(Boolean) as Componente[];
        
        return {
          id: build.id,
          nome: build.nome,
          userId: build.user_id,
          componentes: components,
          orcamento: build.orcamento,
          dataCriacao: build.data_criacao,
          requisitos: build.requisitos as PreferenciaUsuarioInput | undefined,
          avisosCompatibilidade: build.avisos_compatibilidade || [],
        };
      });
      setSavedBuilds(formattedBuilds);
    }
    setIsLoadingBuilds(false);
  }, [currentUser]);

  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);

  const handleDeleteBuild = async (buildId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Tem certeza que deseja excluir esta build? Esta ação não pode ser desfeita.")) {
        return;
    }

    const { error } = await supabase
      .from('builds')
      .delete()
      .eq('id', buildId);

    if (error) {
        console.error("Error deleting build:", error);
        alert(`Falha ao excluir a build: ${error.message}`);
    } else {
        setSavedBuilds(prevBuilds => prevBuilds.filter(b => b.id !== buildId));
        alert("Build excluída com sucesso.");
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
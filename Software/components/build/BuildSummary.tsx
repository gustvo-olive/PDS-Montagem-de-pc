
import React from 'react';
import { Build, SelectedComponent, Componente } from '../../types'; // Tipos atualizados
import Button from '../core/Button';

interface BuildSummaryProps {
  build: Build | null;
  isLoading?: boolean;
  onSaveBuild?: (build: Build) => void;
  onExportBuild?: (build: Build) => void;
  aiRecommendationNotes?: string;
}

const ComponentItem: React.FC<{ component: SelectedComponent }> = ({ component }) => (
  <li className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 px-3 bg-primary rounded-lg hover:bg-primary/80 transition-colors duration-150">
    <div className="flex items-center mb-2 sm:mb-0">
      <img src={component.imageUrl || `https://pjdgcszputgevqggtwhp.supabase.co/storage/v1/object/public/component_images/placeholder.webp`} alt={component.nome} className="w-12 h-12 object-cover rounded-md mr-4" />
      <div>
        <h4 className="font-semibold text-accent text-md">{component.nome}</h4>
        <p className="text-xs text-neutral-dark">{component.tipo} - {component.brand}</p>
      </div>
    </div>
    <p className="font-medium text-neutral text-sm sm:text-base self-end sm:self-center">R$ {component.preco.toFixed(2)}</p>
  </li>
);

// Helper para exibir chaves de forma amigável no resumo da build
const getDisplayKeyForSummary = (category: string, subKey: string): string => {
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


const renderRequisitosData = (data: any, category: string, prefix = ''): JSX.Element[] => {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
      .filter(([key, value]) => value !== undefined && value !== null && value !== '' && !(typeof value === 'boolean' && !value) && typeof value !== 'object')
      .sort(([keyA], [keyB]) => getDisplayKeyForSummary(category, keyA).localeCompare(getDisplayKeyForSummary(category, keyB)))
      .map(([key, value]) => {
        let displayValue = String(value);
        if (typeof value === 'boolean') displayValue = value ? 'Sim' : 'Não';
        if ((key.toLowerCase().includes('temp') || key.toLowerCase().includes('temperatura')) && typeof value === 'number') displayValue += '°C';
        if (key === 'orcamento' && typeof value === 'number') displayValue = `R$ ${value.toFixed(2)}`;
        
        return <li key={prefix + key}><span className="font-medium">{getDisplayKeyForSummary(category, key)}:</span> {displayValue}</li>;
      });
};


const BuildSummary: React.FC<BuildSummaryProps> = ({ build, isLoading, onSaveBuild, onExportBuild, aiRecommendationNotes }) => {
  if (isLoading) {
    return (
      <div className="bg-secondary p-6 rounded-lg shadow-xl text-center">
        <h3 className="text-2xl font-semibold text-accent mb-4">Gerando sua build...</h3>
        {/* ... (skeleton loading state) ... */}
      </div>
    );
  }

  if (!build || build.componentes.length === 0) {
    return (
      <div className="bg-secondary p-6 rounded-lg shadow-xl text-center">
        <h3 className="text-xl font-semibold text-neutral-dark">Nenhuma build para exibir.</h3>
        <p className="text-sm text-neutral-dark mt-2">Inicie uma nova montagem ou selecione componentes.</p>
      </div>
    );
  }
  
  // The build.componentes array is now expected to have full component details from Supabase.
  const detailedComponents = build.componentes;

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-xl">
      <h3 className="text-3xl font-bold text-accent mb-6 pb-3 border-b border-neutral-dark/30">
        Resumo da Build: <span className="text-neutral">{build.nome || 'Minha Nova Build'}</span>
      </h3>
      
      {aiRecommendationNotes && (
        <div className="mb-6 p-4 bg-primary/70 border border-accent/30 rounded-lg">
          <h4 className="font-semibold text-accent mb-2">Notas da IA:</h4>
          <p className="text-sm text-neutral whitespace-pre-wrap">{aiRecommendationNotes}</p>
        </div>
      )}

      {build.avisosCompatibilidade && build.avisosCompatibilidade.length > 0 && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <h4 className="font-semibold text-red-400 mb-2">Avisos de Compatibilidade:</h4>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {build.avisosCompatibilidade.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-3 mb-6">
        {detailedComponents.map((component) => (
          <ComponentItem key={component.id} component={component} />
        ))}
      </ul>

      <div className="mt-8 pt-6 border-t border-neutral-dark/30">
        <div className="flex justify-between items-center mb-6">
          <p className="text-2xl font-semibold text-neutral">Total Estimado:</p>
          <p className="text-3xl font-bold text-accent">R$ {build.orcamento.toFixed(2)}</p> {/* Usar build.orcamento */}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {onSaveBuild && (
            <Button onClick={() => onSaveBuild(build)} variant="primary" size="lg" className="flex-1">
              Salvar Build
            </Button>
          )}
          {onExportBuild && (
            <Button onClick={() => onExportBuild(build)} variant="secondary" size="lg" className="flex-1">
              Exportar Build
            </Button>
          )}
        </div>
      </div>
       {build.requisitos && (
         <div className="mt-6 p-4 bg-primary/50 border border-neutral-dark/50 rounded-md text-xs max-h-60 overflow-y-auto">
            <h4 className="font-semibold text-accent mb-1">Requisitos Usados para esta Build:</h4>
            <ul className="list-disc list-inside space-y-0.5">
                {renderRequisitosData(build.requisitos, 'root', 'req-')}
                {build.requisitos.perfilPC && Object.keys(build.requisitos.perfilPC).length > 0 && (
                  <>
                    <li className="font-semibold text-accent/80 mt-1">Perfil do PC:</li>
                    <ul className="list-disc list-inside pl-4">
                      {renderRequisitosData(build.requisitos.perfilPC, 'perfilPC', 'req-perfil-')}
                    </ul>
                  </>
                )}
                {build.requisitos.ambiente && Object.keys(build.requisitos.ambiente).length > 0 && (
                  <>
                    <li className="font-semibold text-accent/80 mt-1">Ambiente:</li>
                    <ul className="list-disc list-inside pl-4">
                      {renderRequisitosData(build.requisitos.ambiente, 'ambiente', 'req-amb-')}
                    </ul>
                  </>
                )}
            </ul>
        </div>
       )}
    </div>
  );
};

export default BuildSummary;

/**
 * @file Arquivo Central de Tipos (types.ts)
 * @module types
 * @description
 * Este arquivo define todas as principais estruturas de dados (interfaces e tipos)
 * usadas em toda a aplicação, garantindo consistência e segurança de tipos.
 */

/**
 * Representa a estrutura de um usuário logado na aplicação.
 */
export interface User {
  /** ID único do usuário, geralmente do Supabase. */
  id: string;
  /** Nome do usuário. */
  nome: string;
  /** Email do usuário, usado para login. */
  email: string;
}

/**
 * Interface interna para serviços de autenticação, nunca deve ser exposta ou armazenada.
 * O campo 'password_mock' é apenas para propósitos de simulação interna.
 * @internal
 */
export interface UserWithPassword extends User {
  /** Senha mock para simulação interna. */
  password_mock: string;
}

/**
 * Enumeração das categorias de componentes de hardware.
 * Usado para classificar e filtrar componentes.
 */
export enum ComponentCategory {
  CPU = "Processador",
  MOTHERBOARD = "Placa-mãe",
  RAM = "Memória RAM",
  GPU = "Placa de Vídeo",
  STORAGE = "Armazenamento",
  PSU = "Fonte",
  CASE = "Gabinete",
  COOLER = "Cooler",
}

/** Tipos de máquina que o usuário pode querer montar. */
export type MachineType = 
  | 'Computador Pessoal' 
  | 'Servidor' 
  | 'Estação de Trabalho'
  | 'Máquina para Mineração' 
  | 'PC para Streaming' 
  | 'Outro'
  | 'Customizado';

/** Propósitos principais para o uso do PC. */
export type PurposeType = 
  | 'Jogos' 
  | 'Trabalho/Produtividade' 
  | 'Edição Criativa' 
  | 'Uso Geral' 
  | 'HTPC' 
  | 'Outro';

/** Detalhes específicos para cada propósito, usados para refinar as perguntas do chatbot. */
export type GamingType = 'Competitivos/eSports' | 'AAA/High-End' | 'VR' | 'Casual' | 'Outro';
export type WorkField = 'Desenvolvimento' | 'Design Gráfico' | 'Engenharia/3D' | 'Escritório' | 'Ciência de Dados' | 'Outro';
export type CreativeEditingType = 'Vídeo' | 'Foto' | 'Áudio' | '3D' | 'Outro';
export type CreativeWorkResolution = 'HD' | '4K' | '8K' | 'Outro';
export type ProjectSize = 'Pequeno' | 'Médio' | 'Grande';
export type BuildExperience = 'Montar Sozinho' | 'Pré-configurado';
export type AestheticsImportance = 'Baixa' | 'Média' | 'Alta';
export type ServerType = 'Arquivos' | 'Web' | 'Banco de Dados' | 'Virtualização' | 'Render Farm' | 'Outro';
export type ServerUptime = '99%' | '99.9%' | '99.99%' | 'Outro';
export type ServerScalability = 'Baixa' | 'Média' | 'Alta';
export type EnvTempControlType = 'Ar condicionado' | 'Ventilação natural' | 'Outro';
export type CaseSizeType = 'Mini-ITX' | 'Micro-ATX' | 'ATX' | 'Full Tower' | 'Outro';
export type NoiseLevelType = 'Silencioso' | 'Moderado' | 'Indiferente';

/**
 * Representa as condições ambientais onde o PC será utilizado.
 * A IA usa esses dados para otimizar a refrigeração.
 */
export interface Ambiente {
  /** Dados da cidade (obtidos via serviços externos). */
  cidade?: string;
  /** Código do país (ex: "BRA"). */
  codigoPais?: string;
  /** Temperatura média anual da cidade em Celsius. */
  temperaturaMediaAnual?: number;
  /** Temperatura máxima média anual da cidade em Celsius. */
  temperaturaMaximaAnual?: number;
  /** Temperatura mínima média anual da cidade em Celsius. */
  temperaturaMinimaAnual?: number;

  /** Dados do local específico do PC (informados pelo usuário). */
  ventilacaoLocalPC?: 'Ar Condicionado' | 'Ventilador' | 'Ambiente Externo' | 'Outro';
  /** Nível de poeira no local do PC. */
  nivelPoeiraLocalPC?: 'Baixa' | 'Média' | 'Alta';
  /** Cômodo onde o PC ficará. */
  comodoPC?: string;

  /** Condições ambientais gerais. */
  controleTemperaturaGeral?: EnvTempControlType;
  /** Nível de poeira geral. */
  nivelPoeiraGeral?: 'Baixa' | 'Média' | 'Alta';
  
  /** Temperatura ambiente informada. Pode ser inferida. */
  temperatura?: number; 
  /** Nível de umidade no local. */
  umidade?: 'Baixa' | 'Média' | 'Alta'; 
  /** Se o local possui climatização. */
  climatizacao?: boolean; 
  /** Descrição geral da localização. */
  localizacao?: string;
}

/**
 * Agrupa todos os detalhes específicos do perfil do PC.
 * Contém campos que são progressivamente preenchidos pelo chatbot.
 */
export interface PerfilPCDetalhado {
  /** O tipo de máquina a ser montada. */
  machineType?: MachineType;
  /** O propósito principal da máquina. */
  purpose?: PurposeType;
  
  // Campos detalhados para cada propósito.
  gamingType?: GamingType;
  monitorSpecs?: string;
  peripheralsNeeded?: 'Sim' | 'Não' | 'Não especificado';
  workField?: WorkField;
  softwareUsed?: string;
  multipleMonitors?: 'Sim' | 'Não' | 'Não especificado';
  monitorCount?: number;
  creativeEditingType?: CreativeEditingType;
  creativeWorkResolution?: CreativeWorkResolution;
  projectSize?: ProjectSize;
  serverType?: ServerType;
  serverUsers?: string;
  serverRedundancy?: string;
  serverUptime?: ServerUptime;
  serverScalability?: ServerScalability;
  miningCrypto?: string;
  miningHashrate?: string;
  miningGpuCount?: string;
  miningEnergyCost?: string;
  isCustomType?: boolean;
  customDescription?: string;
  criticalComponents?: string;
  usagePatterns?: string;
  physicalConstraints?: string;
  specialRequirements?: string;
  referenceSystems?: string;
  workType?: string; 
}

/**
 * Estrutura principal que agrega todas as informações coletadas do usuário.
 * Este objeto é construído progressivamente pelo chatbot e enviado à IA para a recomendação final.
 */
export interface PreferenciaUsuarioInput { 
  /** O orçamento total para a build. */
  orcamento?: number;
  /** Faixa de orçamento pré-definida ou personalizada. */
  orcamentoRange?: 'Econômico [R$2-4k]' | 'Médio [R$4-8k]' | 'High-End [R$8k+]' | 'Personalizar';
  
  /** Detalhes do tipo e propósito do PC. */
  perfilPC: PerfilPCDetalhado;
  /** Informações sobre o ambiente de uso. */
  ambiente: Ambiente;

  // Preferências gerais do usuário.
  /** Componentes que o usuário já possui e pretende reutilizar. */
  ownedComponents?: string;
  /** Experiência do usuário com montagem de PCs. */
  buildExperience?: BuildExperience;
  /** Preferência por marcas específicas (ex: "AMD", "Nvidia, Intel"). */
  brandPreference?: string;
  /** A importância da estética (ex: RGB, design do gabinete). */
  aestheticsImportance?: AestheticsImportance;
  /** Preferência de tamanho para o gabinete. */
  caseSize?: CaseSizeType;
  /** Nível de ruído aceitável para o sistema. */
  noiseLevel?: NoiseLevelType;
  /** Portas ou conexões específicas necessárias. */
  specificPorts?: string;
  /** Campo genérico para outras preferências não cobertas. */
  preferences?: string;
  
  /** Permite flexibilidade durante a coleta de dados, mas deve ser usado com cautela. */
  [key: string]: unknown; 
}

/**
 * Representa um componente de hardware individual.
 */
export interface Componente {
  /** ID único do componente, geralmente do banco de dados. */
  id: string;
  /** Nome completo do produto. */
  Produto: string;
  /** Preço do componente em BRL. */
  Preco: number;
  /** URL para a página de compra do produto. */
  LinkCompra?: string;
  /** Categoria do componente (ex: "Processador"). */
  Categoria: string;

  /** Marca do componente, inferida do nome do produto. */
  brand?: string;
  /** URL para uma imagem do componente. */
  imageUrl?: string;
  /** Detalhes técnicos do componente. */
  especificacao?: Record<string, string | number | string[]>;
  /** Chave para verificação de compatibilidade (ex: "LGA1700", "AM5"). */
  compatibilityKey?: string;
  /** Data de lançamento do componente. */
  dataLancamento?: string;
}

/**
 * Representa uma montagem de PC completa, com todos os seus componentes e metadados.
 */
export interface Build {
  /** ID único da build, geralmente um UUID. */
  id: string;
  /** Nome dado à build (ex: "Minha Build Gamer"). */
  nome: string;
  /** ID do usuário que criou a build, se aplicável. */
  userId?: string;
  /** Lista de componentes que formam a build. */
  componentes: Componente[];
  /** Custo total da build, somando o preço de todos os componentes. */
  orcamento: number;
  /** Data de criação no formato ISO (YYYY-MM-DDTHH:mm:ss.sssZ). */
  dataCriacao: string;
  
  /** Os requisitos do usuário que geraram esta build. */
  requisitos?: PreferenciaUsuarioInput;
  /** Visão geral ou justificativa da IA para a build, incluindo avisos. */
  justificativa?: string;
  /** Array de avisos de compatibilidade para persistência no DB. */
  avisos_compatibilidade?: string[];
}

/**
 * Representa uma única mensagem na interface do chat.
 */
export interface ChatMessage {
  /** ID único da mensagem. */
  id: string;
  /** Quem enviou a mensagem. */
  sender: 'user' | 'ai' | 'system';
  /** O conteúdo textual da mensagem. */
  text: string;
  /** Timestamp de quando a mensagem foi criada. */
  timestamp: number;
}

/**
 * Estrutura da recomendação retornada pela IA após a anamnese.
 * @deprecated Esta estrutura foi substituída pela resposta JSON em `getLiveBuildResponse`.
 */
export interface AIRecommendation {
  /** IDs dos componentes recomendados pela IA. */
  recommendedComponentIds: string[];
  /** Explicação detalhada das escolhas da IA. */
  justification: string;
  /** Preço total estimado da build. */
  estimatedTotalPrice?: number;
  /** Notas sobre como o orçamento foi utilizado. */
  budgetNotes?: string;
  /** Avisos de compatibilidade ou gargalos potenciais. */
  compatibilityWarnings?: string[];
}

/**
 * Tipo obsoleto, avaliar remoção.
 * @deprecated Não utilizado ativamente.
 */
export type BuildMode = 'auto' | null;

/**
 * Estrutura para futuras regras de compatibilidade.
 * @internal
 */
export interface CompatibilityRules {
  [key: string]: (component: Componente, buildSoFar: Componente[]) => string | null;
}

/**
 * Estrutura para os dados de clima obtidos da API externa.
 */
export interface CityWeatherData {
  /** Temperatura média anual em Celsius. */
  avgTemp: number;
  /** Temperatura máxima média anual em Celsius. */
  maxTemp: number;
  /** Temperatura mínima média anual em Celsius. */
  minTemp: number;
}

/**
 * @typedef {Json}
 * @description Define um tipo para campos JSON no banco de dados.
 * O uso de `any` é uma solução pragmática para evitar erros de "Type instantiation is excessively deep"
 * que podem ocorrer com tipos recursivos complexos gerados pelo Supabase.
 */
export type Json = any;

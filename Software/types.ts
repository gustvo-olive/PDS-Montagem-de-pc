
export interface User {
  id: string;
  nome: string; // Alinhado com o diagrama (anteriormente name)
  email: string;
  // senha não é armazenada aqui, é transitória
}

// This interface is for internal use by the authentication service.
// In a real application, NEVER store plain text passwords. This 'password_mock' field
// is for mock purposes only and should be a salted hash in a production environment.
export interface UserWithPassword extends User {
  password_mock: string;
}


// Enumerações existentes, manter como estão ou mapear para nomes do diagrama se necessário
export enum ComponentCategory {
  CPU = "Processador",
  MOTHERBOARD = "Placa-mãe",
  RAM = "Memória RAM",
  GPU = "Placa de Vídeo",
  STORAGE = "Armazenamento",
  PSU = "Fonte",
  CASE = "Gabinete",
  COOLER = "Cooler CPU",
}
// TipoComponente do diagrama mapeia para ComponentCategory

export type MachineType = 
  | 'Computador Pessoal' 
  | 'Servidor' 
  | 'Estação de Trabalho'
  | 'Máquina para Mineração' 
  | 'PC para Streaming'
  | 'Outro'
  | 'Customizado';

export type PurposeType = 
  | 'Jogos' 
  | 'Trabalho/Produtividade' 
  | 'Edição Criativa' 
  | 'Uso Geral' 
  | 'HTPC' 
  | 'Outro';

// PerfilPC do diagrama é uma combinação de MachineType e PurposeType
// Manter os enums detalhados existentes:
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

// Definição da classe/interface Ambiente (conforme diagrama e dados existentes)
export interface Ambiente {
  // Dados da cidade (via geoService/weatherService)
  cidade?: string;
  codigoPais?: string;
  temperaturaMediaCidade?: number;
  temperaturaMaximaCidade?: number;
  temperaturaMinimaCidade?: number;
  descricaoClimaCidade?: string;

  // Dados do local específico do PC
  ventilacaoLocalPC?: 'Ar Condicionado' | 'Ventilador' | 'Ambiente Externo' | 'Outro';
  nivelPoeiraLocalPC?: 'Baixa' | 'Média' | 'Alta';
  comodoPC?: string;

  // Condições ambientais gerais
  controleTemperaturaGeral?: EnvTempControlType;
  nivelPoeiraGeral?: 'Baixa' | 'Média' | 'Alta';

  // Mapeamento direto de atributos do diagrama (podem ser inferidos ou entradas diretas)
  temperatura?: number; // Para atributo `temperatura: double` do diagrama (pode ser temp. média)
  umidade?: 'Baixa' | 'Média' | 'Alta'; // Para `umidade: double` (adaptado para os tipos existentes)
  climatizacao?: boolean; // Para `climatizacao: boolean` (pode ser inferido de ventilacaoLocalPC)
  localizacao?: string; // Para `localizacao: String` (descrição geral, pode ser cidade ou comodoPC)
}

// Detalhes do Perfil do PC, agrupando especificidades de AnamnesisData
export interface PerfilPCDetalhado {
  machineType?: MachineType;
  purpose?: PurposeType;
  // Jogos
  gamingType?: GamingType;
  monitorSpecs?: string;
  peripheralsNeeded?: 'Sim' | 'Não' | 'Não especificado';
  // Trabalho/Produtividade
  workField?: WorkField;
  softwareUsed?: string;
  multipleMonitors?: 'Sim' | 'Não' | 'Não especificado';
  monitorCount?: number;
  // Edição Criativa
  creativeEditingType?: CreativeEditingType;
  creativeWorkResolution?: CreativeWorkResolution;
  projectSize?: ProjectSize;
  // Servidor
  serverType?: ServerType;
  serverUsers?: string;
  serverRedundancy?: string;
  serverUptime?: ServerUptime;
  serverScalability?: ServerScalability;
  // Mineração
  miningCrypto?: string;
  miningHashrate?: string;
  miningGpuCount?: string;
  miningEnergyCost?: string;
  // Customizado
  isCustomType?: boolean;
  customDescription?: string;
  criticalComponents?: string;
  usagePatterns?: string;
  physicalConstraints?: string;
  specialRequirements?: string;
  referenceSystems?: string;
  // Outros campos de AnamnesisData que definem o perfil
  workType?: string; // Legado, pode ser coberto por workField
}

// Refatoração de AnamnesisData para PreferenciaUsuarioInput
export interface PreferenciaUsuarioInput { // Anteriormente AnamnesisData
  orcamento?: number; // Diagrama: orcamento: int
  orcamentoRange?: 'Econômico [R$2-4k]' | 'Médio [R$4-8k]' | 'High-End [R$8k+]' | 'Personalizar';
  
  perfilPC: PerfilPCDetalhado;
  ambiente: Ambiente;

  // Preferências gerais
  buildExperience?: BuildExperience;
  brandPreference?: string;
  aestheticsImportance?: AestheticsImportance;
  caseSize?: CaseSizeType;
  noiseLevel?: NoiseLevelType;
  specificPorts?: string;
  preferences?: string; // Campo genérico para outras preferências
  
  // Dados climáticos da cidade que estavam no nível raiz de AnamnesisData, agora movidos para Ambiente
  // city?: string; // Movido para Ambiente.cidade
  // countryCode?: string; // Movido para Ambiente.codigoPais
  // cityAvgTemp?: number; // Movido para Ambiente.temperaturaMediaCidade
  // cityMaxTemp?: number; // Movido para Ambiente.temperaturaMaximaCidade
  // cityMinTemp?: number; // Movido para Ambiente.temperaturaMinimaCidade
  // cityWeatherDescription?: string; // Movido para Ambiente.descricaoClimaCidade
  
  // // Detalhes do local do PC movidos para Ambiente
  // pcVentilation?: 'Ar Condicionado' | 'Ventilador' | 'Ambiente Externo' | 'Outro'; // Movido
  // pcDustLevel?: 'Baixa' | 'Média' | 'Alta'; // Movido
  // pcRoomType?: string; // Movido

  // // Condições gerais do ambiente movidas para Ambiente
  // envTempControl?: EnvTempControlType; // Movido
  // envDust?: 'Baixa' | 'Média' | 'Alta'; // Movido

  // Campos legados de AnamnesisData (avaliar se ainda necessários ou cobertos por Ambiente/PerfilPCDetalhado)
  // envTemperature?: 'Baixa' | 'Média' | 'Alta'; 
  // envHumidity?: 'Baixa' | 'Média' | 'Alta';
  [key: string]: any; // Manter para flexibilidade durante o chat, mas usar com cautela
}


export interface Componente { // Anteriormente PCComponent
  id: string;
  tipo: ComponentCategory; // Diagrama: tipo: TipoComponente
  nome: string; // Diagrama: nome: String
  brand: string; // Extra, manter
  preco: number; // Diagrama: preco: double
  imageUrl?: string; // Extra, manter
  // Diagrama: especificacao: Map<String, String>. Código usa Record mais flexível.
  especificacao: Record<string, string | number | string[]>; 
  compatibilityKey?: string; // Extra, manter
  dataLancamento?: string; // Diagrama: dataLancamento: Date. Adicionar se disponível (string ISO)
  linkCompra?: string; // Diagrama: linkCompra: String. Adicionar se disponível
}

// SelectedComponent pode ser removido se for idêntico a Componente.
// Se SelectedComponent tiver atributos próprios (ex: quantidade), então manter.
// Por ora, assumindo que pode ser simplificado. Build.componentes usará Componente[].
export interface SelectedComponent extends Componente {} // Avaliar remoção

export interface Build {
  id: string;
  nome: string; // Diagrama: nome: String
  userId?: string; // Extra, útil para persistência
  componentes: SelectedComponent[]; // Diagrama: componentes: List<Componente>
  orcamento: number; // Diagrama: orcamento: double (era totalPrice)
  dataCriacao: string; // Diagrama: dataCriacao: Date (era createdAt, string ISO)
  
  requisitos?: PreferenciaUsuarioInput; // Extra valioso (era requirements, tipo atualizado)
  avisosCompatibilidade?: string[]; // Extra valioso (era compatibilityIssues)
}


export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

export interface AIRecommendation {
  recommendedComponentIds: string[];
  justification: string;
  estimatedTotalPrice?: number;
  budgetNotes?: string;
  compatibilityWarnings?: string[];
}

export type BuildMode = 'auto' | null; // Avaliar se ainda é usado

// Para compatibilidade - pode ser usado por um futuro compatibilityService.ts
export interface CompatibilityRules {
  [key: string]: (component: Componente, buildSoFar: SelectedComponent[]) => string | null;
}

// Estrutura para dados de clima da cidade (já existente, parece OK)
export interface CityWeatherData {
  avgTemp: number;
  maxTemp: number;
  minTemp: number;
  description: string;
}

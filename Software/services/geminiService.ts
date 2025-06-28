
import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { PreferenciaUsuarioInput, ChatMessage, Componente, AIRecommendation, MachineType, PurposeType, GamingType, WorkField, CreativeEditingType, CreativeWorkResolution, ProjectSize, BuildExperience, AestheticsImportance, ServerType, ServerUptime, ServerScalability, EnvTempControlType, CaseSizeType, NoiseLevelType, Ambiente, PerfilPCDetalhado } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is não está configurada. Por favor, defina a variável de ambiente process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "NO_KEY_PROVIDED" }); 
const TEXT_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

const parseJsonFromGeminiResponse = <T,>(responseText: string): T | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Falha ao analisar resposta JSON do Gemini:", e, "\nResposta Bruta:", responseText);
    return null;
  }
};


export const getChatbotResponse = async (
  history: ChatMessage[],
  userInput: string,
  currentPreferencias: PreferenciaUsuarioInput
): Promise<{ aiResponse: string; updatedPreferencias: PreferenciaUsuarioInput }> => {
  if (!API_KEY) return { aiResponse: "Desculpe, o serviço de IA não está configurado corretamente (sem API Key).", updatedPreferencias: currentPreferencias };

  const chatHistoryForGemini: Content[] = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : (msg.sender === 'ai' ? 'model' : 'user'),
    parts: [{ text: msg.text }],
  }));

  let weatherInfoForSystem = "";
  if (currentPreferencias.ambiente?.cidade && currentPreferencias.ambiente?.temperaturaMaximaCidade !== undefined && currentPreferencias.ambiente?.temperaturaMediaCidade !== undefined && currentPreferencias.ambiente?.temperaturaMinimaCidade !== undefined) {
    weatherInfoForSystem = `Dados climáticos para ${currentPreferencias.ambiente.cidade}: Temp. Média ${currentPreferencias.ambiente.temperaturaMediaCidade}°C, Máx ${currentPreferencias.ambiente.temperaturaMaximaCidade}°C, Mín ${currentPreferencias.ambiente.temperaturaMinimaCidade}°C. Clima: ${currentPreferencias.ambiente.descricaoClimaCidade || 'N/A'}. Considere isso para refrigeração.`;
  } else if (currentPreferencias.ambiente?.cidade && currentPreferencias.ambiente?.temperaturaMediaCidade !== undefined) {
     weatherInfoForSystem = `Dados climáticos para ${currentPreferencias.ambiente.cidade}: Temp. Média ${currentPreferencias.ambiente.temperaturaMediaCidade}°C. Clima: ${currentPreferencias.ambiente.descricaoClimaCidade || 'N/A'}. Considere isso para refrigeração.`;
  }


  const systemInstruction = `Você é CodeTuga, um assistente especializado em montagem de PCs. Siga este fluxo inteligente e conciso para coleta de requisitos.

ESTADO ATUAL DA COLETA (PreferenciaUsuarioInput): ${JSON.stringify(currentPreferencias)}
${weatherInfoForSystem ? `\nINFORMAÇÃO CLIMÁTICA DISPONÍVEL: ${weatherInfoForSystem}` : ''}

FLUXO DE PERGUNTAS INTELIGENTE E CONCISO:

1.  **Identificação do Tipo de Máquina** (se \`!currentPreferencias.perfilPC.machineType\`):
    Pergunte: "Que tipo de máquina você deseja montar? (ex: Computador Pessoal para Jogos, Servidor, Estação de Trabalho)"

2.  **Fluxos Específicos por Tipo** (após \`perfilPC.machineType\` ser definido):

    ### Para Computador Pessoal (\`currentPreferencias.perfilPC.machineType === 'Computador Pessoal'\`):
    a.  **Propósito Principal** (se \`!currentPreferencias.perfilPC.purpose\`):
        Pergunte: "Qual será o uso principal? (Jogos, Trabalho/Produtividade, Edição Criativa, Uso Geral)"
    
    b.  **Sub-fluxos por Propósito** (faça apenas a pergunta mais relevante):
        - Para **Jogos**: Se \`!currentPreferencias.perfilPC.gamingType\`, pergunte "Que tipo de jogos? (Competitivos/eSports, AAA/High-End)" e se \`!currentPreferencias.perfilPC.monitorSpecs\`, inclua "Qual a resolução e taxa de atualização do seu monitor? (Ex: 1080p/144Hz)".
        - Para **Trabalho/Produtividade**: Se \`!currentPreferencias.perfilPC.workField\`, pergunte "Qual sua área de trabalho? (Desenvolvimento, Design Gráfico, Engenharia/3D)" e se \`!currentPreferencias.perfilPC.softwareUsed\`, inclua "Quais os softwares mais exigentes que você usa?".
        - Para **Edição Criativa**: Se \`!currentPreferencias.perfilPC.creativeEditingType\`, pergunte "Qual tipo de edição? (Vídeo, Foto, 3D)" e se \`!currentPreferencias.perfilPC.creativeWorkResolution\`, inclua "Qual a resolução principal de trabalho? (HD, 4K, 8K)".

3.  **Orçamento** (coletar após entender as necessidades principais, se \`!currentPreferencias.orcamento\` e \`!currentPreferencias.orcamentoRange\`):
    Pergunte: "Qual faixa de orçamento você tem em mente em BRL (Reais)? (Ex: Econômico [até R$4000], Médio [R$4000-R$8000], High-End [R$8000+], ou um valor específico)"

4.  **Permissão de Localização** (após orçamento, se \`!currentPreferencias.ambiente.cidade\` E a pergunta ainda não foi feita):
    Pergunte EXATAMENTE: "Para ajudar a otimizar a refrigeração, você permite que detectemos sua localização para verificar o clima?"

5.  **Preferências Finais (Opcional)** (após as etapas anteriores):
    Se os campos críticos estiverem preenchidos e o campo \`preferences\` ainda não foi alterado, pergunte de forma aberta: "Ótimo. Para finalizar, você tem alguma outra preferência importante que eu deva saber? Isso pode incluir estética (como iluminação RGB), tamanho específico do gabinete (compacto, grande), nível de ruído (silencioso), ou necessidade de Wi-Fi/Bluetooth." Se o usuário disser 'não' ou pular, prossiga para a validação.

6.  **Validação Final e Conclusão**:
    Quando os campos CRÍTICOS (machineType, purpose/workField, budget) estiverem preenchidos, resuma brevemente:
    "Ok, coletei as informações principais: [Liste 2-3 pontos chave]. Está tudo correto para eu gerar uma recomendação de build?"

REGRAS DE INTERAÇÃO:
- Faça UMA pergunta por vez. Seja direto e conciso.
- EVITE fazer perguntas sobre detalhes que podem ser inferidos (como tamanho do gabinete ou nível de ruído), a menos que o usuário os mencione. Pergunte sobre eles de forma opcional na etapa 5.
- Se o usuário fornecer múltiplas informações, processe-as e faça a PRÓXIMA pergunta lógica no fluxo.
- Responda APENAS com sua próxima pergunta ou a validação final.
`;

  try {
    const userMessageContent: Content = { role: 'user', parts: [{ text: userInput }] };
    const contents: Content[] = [...chatHistoryForGemini, userMessageContent];
    
    const result: GenerateContentResponse = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      },
    });
    
    const aiText = result.text;
    // Criar cópias profundas para evitar mutações diretas
    const updatedPreferencias: PreferenciaUsuarioInput = JSON.parse(JSON.stringify(currentPreferencias));
    if (!updatedPreferencias.perfilPC) updatedPreferencias.perfilPC = {} as PerfilPCDetalhado;
    if (!updatedPreferencias.ambiente) updatedPreferencias.ambiente = {} as Ambiente;

    const lowerInput = userInput.toLowerCase();
    
    let lastAiQuestionText = "";
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender === 'ai') {
            lastAiQuestionText = history[i].text.toLowerCase();
            break;
        }
    }
    
    const parseGenericOptions = (input: string, options: Record<string, string>): string | undefined => {
      for (const [key, value] of Object.entries(options)) {
        if (input.includes(key)) return value;
      }
      return undefined;
    };

    const FEMININE_DUST_LEVEL_MAP: Record<string, 'Baixa' | 'Média' | 'Alta'> = {
      'baixo': 'Baixa', 'baixa': 'Baixa',
      'médio': 'Média', 'media': 'Média',
      'alto': 'Alta', 'alta': 'Alta'
    };

    // 1. Machine Type
    if (lastAiQuestionText.includes("que tipo de máquina você deseja montar?") && !updatedPreferencias.perfilPC.machineType) {
        const typeMap: Record<string, MachineType> = { /* ... manter mapeamentos ... */ };
        updatedPreferencias.perfilPC.machineType = parseGenericOptions(lowerInput, typeMap) as MachineType;
        if (lowerInput.length > 2 && !updatedPreferencias.perfilPC.machineType) {
            const customTypes: Record<string, MachineType> = { /* ... */ };
            updatedPreferencias.perfilPC.machineType = parseGenericOptions(lowerInput, customTypes) as MachineType || 'Customizado';
            updatedPreferencias.perfilPC.isCustomType = true;
            if(!updatedPreferencias.perfilPC.customDescription) updatedPreferencias.perfilPC.customDescription = userInput;
        }
    }

    // 2. Fluxos Específicos - Exemplo para Computador Pessoal > Propósito
    if (updatedPreferencias.perfilPC.machineType === 'Computador Pessoal') {
        if (lastAiQuestionText.includes("qual será o uso principal?") && !updatedPreferencias.perfilPC.purpose) {
            const purposeMap: Record<string, PurposeType> = { /* ... manter mapeamentos ... */ };
            updatedPreferencias.perfilPC.purpose = parseGenericOptions(lowerInput, purposeMap) as PurposeType;
        }
        // ... adaptar todos os outros parsers para acessar updatedPreferencias.perfilPC.campo ou updatedPreferencias.ambiente.campo ...
        // Exemplo para Jogos > gamingType
        if (updatedPreferencias.perfilPC.purpose === 'Jogos') {
            if (lastAiQuestionText.includes("que tipo de jogos você pretende jogar?") && !updatedPreferencias.perfilPC.gamingType) {
                const gameTypeMap: Record<string, GamingType> = { /* ... */ };
                updatedPreferencias.perfilPC.gamingType = parseGenericOptions(lowerInput, gameTypeMap) as GamingType;
            }
            // ... e assim por diante para monitorSpecs, peripheralsNeeded
        }
    }
    
    // 3. Orçamento
    if (lastAiQuestionText.includes("faixa de orçamento") && (!updatedPreferencias.orcamento && !updatedPreferencias.orcamentoRange)) {
        // ... lógica de parsing para updatedPreferencias.orcamento e updatedPreferencias.orcamentoRange ...
        const budgetRangesMap: Record<string, { range: PreferenciaUsuarioInput['orcamentoRange'], value?: number }> = {
            'econômico': { range: 'Econômico [R$2-4k]', value: 3000 }, 
            // ... outros mapeamentos ...
        };
        // ... (lógica de parsing adaptada)
         const numMatch = userInput.match(/(\d[\d.,]*\d|\d+)/g);
        if (numMatch) {
            const cleanedNumber = parseFloat(numMatch[0].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(cleanedNumber)) {
                 updatedPreferencias.orcamento = cleanedNumber;
                 if(!updatedPreferencias.orcamentoRange) updatedPreferencias.orcamentoRange = 'Personalizar'; 
            }
        }
    }

    // 5. Condições Ambientais Específicas
     if (lastAiQuestionText.includes("ar condicionado") || lastAiQuestionText.includes("ventilador") || lastAiQuestionText.includes("ventilação onde a máquina será usada")) {
        if (lowerInput.includes("ar condicionado")) updatedPreferencias.ambiente.ventilacaoLocalPC = "Ar Condicionado";
        else if (lowerInput.includes("ventilador")) updatedPreferencias.ambiente.ventilacaoLocalPC = "Ventilador";
        // ... etc
    }
    if (lastAiQuestionText.includes("nível de poeira nesse local específico")) {
        updatedPreferencias.ambiente.nivelPoeiraLocalPC = parseGenericOptions(lowerInput, FEMININE_DUST_LEVEL_MAP) as 'Baixa' | 'Média' | 'Alta';
    }
    if (lastAiQuestionText.includes("qual cômodo a máquina será utilizada") && !updatedPreferencias.ambiente.comodoPC && userInput.trim().length > 2) {
        updatedPreferencias.ambiente.comodoPC = userInput.trim().charAt(0).toUpperCase() + userInput.trim().slice(1);
    }
    
    // 6. Condições Ambientais Gerais
     if (lastAiQuestionText.includes("ambiente geral") && lastAiQuestionText.includes("controle de temperatura") && !updatedPreferencias.ambiente.controleTemperaturaGeral) {
        const tempControlMap: Record<string, EnvTempControlType> = { /* ... */ };
        updatedPreferencias.ambiente.controleTemperaturaGeral = parseGenericOptions(lowerInput, tempControlMap) as EnvTempControlType;
    }
    if (lastAiQuestionText.includes("nível de poeira geral nesse ambiente") && !updatedPreferencias.ambiente.nivelPoeiraGeral) {
        updatedPreferencias.ambiente.nivelPoeiraGeral = parseGenericOptions(lowerInput, FEMININE_DUST_LEVEL_MAP) as 'Baixa' | 'Média' | 'Alta';
    }

    // 7. Preferências Adicionais Gerais (parsing)
    if (lastAiQuestionText.includes("preferência importante")) {
        if (!updatedPreferencias.preferences) updatedPreferencias.preferences = userInput;
        
        const caseSizeMap: Record<string, CaseSizeType> = { "compacto": 'Mini-ITX', "pequeno": 'Micro-ATX', "padrão": 'ATX', "grande": 'Full Tower' };
        updatedPreferencias.caseSize = parseGenericOptions(lowerInput, caseSizeMap) as CaseSizeType || updatedPreferencias.caseSize;

        const noiseLevelMap: Record<string, NoiseLevelType> = { "silencioso": 'Silencioso', "quieto": 'Silencioso', "moderado": 'Moderado', "indiferente": 'Indiferente' };
        updatedPreferencias.noiseLevel = parseGenericOptions(lowerInput, noiseLevelMap) as NoiseLevelType || updatedPreferencias.noiseLevel;
        
        const aestheticsMap: Record<string, AestheticsImportance> = { "rgb": 'Alta', "luzes": 'Alta', "estética": 'Média', "aparência": 'Média', "discreto": 'Baixa' };
        updatedPreferencias.aestheticsImportance = parseGenericOptions(lowerInput, aestheticsMap) as AestheticsImportance || updatedPreferencias.aestheticsImportance;
    }


    return { aiResponse: aiText, updatedPreferencias };

  } catch (error) {
    console.error("Erro ao chamar API Gemini (getChatbotResponse):", error);
    const typedError = error as any;
    if (typedError?.error?.code === 429 || String(typedError).includes('429')) {
      return { 
        aiResponse: "Estou recebendo muitas solicitações no momento. Por favor, aguarde alguns instantes antes de tentar novamente.", 
        updatedPreferencias: currentPreferencias 
      };
    }
    return { aiResponse: "Desculpe, ocorreu um erro ao processar sua solicitação.", updatedPreferencias: currentPreferencias };
  }
};


export const getBuildRecommendation = async (
  requisitos: PreferenciaUsuarioInput, // Tipo atualizado
  availableComponents: Componente[] // Tipo atualizado
): Promise<AIRecommendation | null> => {
  if (!API_KEY) {
    console.error("API Key do Gemini não configurada para getBuildRecommendation");
    return null;
  }

  const componentSummary = availableComponents.map(c => ({
    id: c.id,
    tipo: c.tipo,
    nome: c.nome,
    preco: c.preco,
    key_specs: `${c.especificacao.socket || c.especificacao.type || ''} ${c.especificacao.chipset || c.especificacao.capacity_gb || ''} ${c.especificacao.tdp || c.especificacao.wattage_w || ''}`.trim()
  }));

  // O prompt precisará ser cuidadosamente ajustado para refletir a nova estrutura aninhada de requisitos.perfilPC e requisitos.ambiente
  const prompt = `
Você é um especialista em montagem de PCs. Sua tarefa é recomendar uma build otimizada com base nos seguintes requisitos e componentes disponíveis.

Requisitos do Usuário (PreferenciaUsuarioInput):
- Orçamento:
  - Faixa Escolhida: ${requisitos.orcamentoRange || 'Não especificado'}
  - Valor Numérico (BRL): ${requisitos.orcamento ? requisitos.orcamento.toFixed(2) : 'Não especificado, otimizar custo-benefício'}

- Perfil do PC:
  - Tipo de Máquina: ${requisitos.perfilPC.machineType || 'Não especificado'}
  - Propósito Principal: ${requisitos.perfilPC.purpose || 'Não especificado'}
  - Detalhes (Jogos/Trabalho/etc.): ${requisitos.perfilPC.gamingType || requisitos.perfilPC.workField || requisitos.perfilPC.creativeEditingType || 'N/A'}
  - Softwares Principais: ${requisitos.perfilPC.softwareUsed || 'N/A'}

- Ambiente:
  - Cidade (Clima): ${requisitos.ambiente.cidade ? `${requisitos.ambiente.cidade}, Temp. Média: ${requisitos.ambiente.temperaturaMediaCidade}°C` : 'Não informado'}
  - Local Específico do PC: Ventilação: ${requisitos.ambiente.ventilacaoLocalPC || 'Não informado'}, Poeira: ${requisitos.ambiente.nivelPoeiraLocalPC || 'Não informado'}

- Preferências Gerais Adicionais:
  - Experiência de Montagem: ${requisitos.buildExperience || 'Não especificado'}
  - Preferência de Marcas: ${requisitos.brandPreference || 'Nenhuma'}
  - Importância da Estética: ${requisitos.aestheticsImportance || 'Não especificada'}
  - Tamanho do Gabinete: ${requisitos.caseSize || 'Não especificado'}
  - Nível de Ruído: ${requisitos.noiseLevel || 'Indiferente'}
  - Outras Preferências (texto livre): ${requisitos.preferences || 'Nenhuma'}

Componentes Disponíveis (ID, Tipo, Nome, Preço, Especificações Chave):
${JSON.stringify(componentSummary, null, 2)}

Instruções:
1.  Selecione UM componente para cada categoria essencial (CPU, Placa-mãe, RAM, Armazenamento, Fonte, Gabinete, Cooler CPU).
2.  Placa de Vídeo (GPU) é OBRIGATÓRIA, exceto para Servidores de Arquivos/Web básicos.
3.  Priorize compatibilidade (socket CPU/Mobo, tipo de RAM, etc.) e otimize para o \`purpose\` e \`orcamento\`.
4.  Considere o CLIMA e o AMBIENTE para a refrigeração (gabinete e cooler). Ambientes quentes ou empoeirados precisam de melhor fluxo de ar e filtros.
5.  Faça escolhas inteligentes para preferências não especificadas. Por exemplo:
    - **Tamanho do Gabinete**: Se não especificado, escolha ATX Mid-Tower para a maioria. Para HTPC ou builds de escritório, considere Micro-ATX. Para multi-GPU ou refrigeração customizada, um Full Tower.
    - **Nível de Ruído**: Se não especificado, priorize silêncio para HTPC e edição de áudio. Para jogos, o desempenho de refrigeração é mais importante que o silêncio absoluto.
    - **Estética**: Se a importância for 'Baixa' ou não especificada, foque no custo-benefício e não em componentes com RGB.
6.  Se o orçamento for insuficiente, explique no 'budgetNotes'.
7.  Calcule o preço total. Forneça justificativa e avisos de compatibilidade.

Responda OBRIGATORIAMENTE em formato JSON. O JSON deve ter a seguinte estrutura:
{
  "recommendedComponentIds": ["id_cpu", "id_mobo", ...],
  "justification": "Breve explicação das escolhas.",
  "estimatedTotalPrice": 1234.56,
  "budgetNotes": "Notas sobre o orçamento, se aplicável.",
  "compatibilityWarnings": ["Aviso 1", "Aviso 2"]
}
Não inclua nenhum texto fora do bloco JSON.
`;

  try {
    const result: GenerateContentResponse = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });
    
    const recommendation = parseJsonFromGeminiResponse<AIRecommendation>(result.text);
    return recommendation;

  } catch (error) {
    console.error("Erro ao chamar API Gemini (getBuildRecommendation):", error);
    const typedError = error as any;
    if (typedError?.error?.code === 429 || String(typedError).includes('429')) {
        throw new Error("O limite de solicitações da IA foi atingido. Por favor, aguarde um momento e tente gerar a recomendação novamente.");
    }
    
    // @ts-ignore
    if (error.response && error.response.text) {
       // @ts-ignore
      console.error("Resposta de Erro do Gemini:", await error.response.text());
    }
    return null;
  }
};

/**
 * @file Serviço de Interação com a API Google Gemini.
 * @module services/geminiService
 * @description
 * Este módulo encapsula toda a lógica de comunicação com a API Google Gemini.
 * Ele é responsável por construir prompts, enviar requisições para o modelo de IA,
 * e processar as respostas para a montagem de PCs em tempo real.
 */

// Importa os tipos e classes necessários do SDK do Google GenAI e dos tipos locais.
import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { PreferenciaUsuarioInput, ChatMessage, Componente, Ambiente, PerfilPCDetalhado, Build, AnamnesisResponse, BuildResponse } from '../types';

// Obtém a chave da API a partir das variáveis de ambiente.
const API_KEY = process.env.API_KEY;

// Validação da chave da API. Se não estiver definida, exibe um erro no console.
if (!API_KEY) {
  console.error("API_KEY for Gemini is não está configurada. Por favor, defina a variável de ambiente process.env.API_KEY.");
}

// Inicializa o cliente da API Gemini. Fornece uma chave substituta para evitar falhas na inicialização.
const ai = new GoogleGenAI({ apiKey: API_KEY || "NO_KEY_PROVIDED" });
const TEXT_MODEL_NAME = 'gemini-2.5-flash';

/**
 * Analisa a resposta de texto do Gemini para extrair um bloco de código JSON.
 * Lida com formatação markdown (```json ... ```) e texto adicional antes/depois do JSON.
 * @template T - O tipo de objeto esperado após a análise do JSON.
 * @param {string} responseText - A resposta de texto bruta da API.
 * @returns {T | null} Um objeto do tipo genérico T ou nulo se a análise falhar.
 * @private
 */
const parseJsonFromGeminiResponse = <T,>(responseText: string): T | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e1) {
    const fixedJsonStr = jsonStr.replace(/}(\s*),/g, '$1,');
    try {
      return JSON.parse(fixedJsonStr) as T;
    } catch (e2) {
      console.error("Falha ao analisar resposta JSON do Gemini (após tentativa de correção):", e1, "\nResposta Bruta:", responseText, "\nString Analisada (original):", jsonStr);
      return null;
    }
  }
};


/**
 * Pré-filtra a lista de componentes antes de enviá-la para a IA.
 * Isso reduz o tamanho do prompt, economiza tokens e melhora a relevância das recomendações.
 * Se um orçamento é fornecido, seleciona os componentes mais próximos do preço alvo para cada categoria.
 * @param {Componente[]} components - Lista completa de componentes disponíveis.
 * @param {number} [budget] - Orçamento fornecido pelo usuário.
 * @returns {Componente[]} Uma lista de componentes filtrada e mais relevante.
 */
export const preFilterComponents = (components: Componente[], budget?: number): Componente[] => {
    const COMPONENT_COUNT_PER_CATEGORY = 20; // Aumentado para dar mais opções à IA

    if (!budget || budget <= 0) {
        const maxComponents = COMPONENT_COUNT_PER_CATEGORY * 8;
        if (components.length <= maxComponents) return components;
        const shuffled = [...components].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxComponents);
    }

    const budgetDistribution: Record<string, number> = {
        'Processadores': 0.20, 'Placas de Vídeo': 0.35, 'Placas-Mãe': 0.12,
        'Memória RAM': 0.08, 'SSD': 0.08, 'Fonte': 0.07,
        'Gabinete': 0.05, 'Cooler': 0.05,
    };

    const finalFilteredComponents = new Map<string, Componente>();
    const allCategories = [...new Set(components.map(c => c.Categoria))];

    allCategories.forEach(category => {
        const categoryComponents = components.filter(c => c.Categoria === category);
        if (categoryComponents.length === 0) return;
        
        const targetPrice = budget * (budgetDistribution[category] || 0.05);

        const sortedComponents = [...categoryComponents].sort((a, b) => {
            const diffA = Math.abs(a.Preco - targetPrice);
            const diffB = Math.abs(b.Preco - targetPrice);
            return diffA - diffB;
        });
        
        const topN = sortedComponents.slice(0, COMPONENT_COUNT_PER_CATEGORY);
        topN.forEach(comp => {
            if (!finalFilteredComponents.has(comp.id)) {
                finalFilteredComponents.set(comp.id, comp);
            }
        });
    });

    return Array.from(finalFilteredComponents.values());
};

/**
 * Conduz a conversa de anamnese para coletar os requisitos do usuário.
 * @param history - Histórico de mensagens da conversa.
 * @param userInput - A última mensagem enviada pelo usuário.
 * @param currentPreferencias - O estado atual das preferências coletadas.
 * @returns Um objeto contendo a resposta da IA, preferências atualizadas e um flag indicando se a anamnese está completa.
 */
export const conductAnamnesis = async (
  history: ChatMessage[],
  userInput: string,
  currentPreferencias: PreferenciaUsuarioInput,
): Promise<AnamnesisResponse | null> => {
    if (!API_KEY) {
        console.error("API Key do Gemini não configurada.");
        return null;
    }

    const isStartingConversation = userInput === 'INICIAR_CONVERSA';
    const historyTextLower = history.map(h => h.text).join('\n').toLowerCase();
    const locationAlreadyHandled = !!currentPreferencias.ambiente?.cidade || historyTextLower.includes('não permitiu detecção automática') || historyTextLower.includes('não foi possível detectar');

    const systemInstruction = `Você é CodeTuga, um especialista em montagem de PCs. Sua tarefa é APENAS conduzir a anamnese (coleta de requisitos). Em CADA turno, você deve:
1.  **Analisar e Atualizar:** Analisar a mensagem do usuário, o histórico e o \`currentPreferencias\`. Atualize o objeto \`PreferenciaUsuarioInput\` com as novas informações. NÃO remova dados existentes.
2.  **Perguntar:** Determine a próxima pergunta lógica a ser feita para obter mais informações, seguindo estritamente o "Fluxo de Perguntas".
3.  **Finalizar Anamnese:** Quando você tiver coletado o ORÇAMENTO e o PROPÓSITO PRINCIPAL, defina \`isComplete: true\` no seu JSON de resposta.

**Fluxo de Perguntas (Siga esta ordem):**
*   SE \`!orcamento\` e \`!orcamentoRange\`, pergunte pelo orçamento.
*   SENÃO, SE \`!perfilPC.purpose\`, pergunte pelo propósito principal.
*   SENÃO, SE (propósito é 'Jogos' e \`!perfilPC.gamingType\`), pergunte pelo tipo de jogo.
*   SENÃO, SE (propósito é 'Trabalho/Produtividade' e \`!perfilPC.workField\`), pergunte pela área de trabalho.
*   SENÃO, SE (propósito é 'Edição Criativa' e \`!perfilPC.creativeEditingType\`), pergunte pelo tipo de edição.
*   SENÃO, SE \`!ownedComponents\`, pergunte se o usuário já possui alguma peça.
*   SENÃO, SE ${!locationAlreadyHandled}, peça permissão para detectar a localização para otimizar a refrigeração. **Ao fazer esta pergunta, defina "actionRequired": "request_location_permission" no JSON de resposta.**
*   SENÃO, SE \`!preferences\`, pergunte por outras preferências (estética, ruído, etc.).
*   SENÃO (TODOS os dados coletados), confirme que a anamnese está completa.

**Formato da Saída (JSON OBRIGATÓRIO):**
\`\`\`json
{
  "actionRequired": "none",
  "aiResponseText": "Sua próxima pergunta.",
  "updatedPreferencias": { /* O objeto PreferenciaUsuarioInput COMPLETO e ATUALIZADO */ },
  "isComplete": false
}
\`\`\`
**IMPORTANTE: NUNCA inclua 'recommendedComponentIds', 'justification', ou 'estimatedTotalPrice' nesta fase.**

**Contexto Atual:**
- Objeto \`currentPreferencias\`: ${JSON.stringify(currentPreferencias)}
`;
    
    try {
        const userMessageForPrompt = isStartingConversation
            ? "A conversa está apenas começando. Siga o 'Fluxo de Perguntas' e faça a primeira pergunta."
            : `Última mensagem do usuário: "${userInput}"`;

        const chatHistoryForGemini: Content[] = history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));
        const contents: Content[] = [...chatHistoryForGemini, { role: 'user', parts: [{ text: userMessageForPrompt }] }];
        
        const result: GenerateContentResponse = await ai.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            },
        });
        
        const parsedResponse = parseJsonFromGeminiResponse<AnamnesisResponse>(result.text);

        if (!parsedResponse || !parsedResponse.aiResponseText || !parsedResponse.updatedPreferencias) {
            console.error("Resposta da IA (Anamnese) está malformada ou incompleta.", result.text);
            return null;
        }

        const orcamentoAny = (parsedResponse.updatedPreferencias as any).orcamento;
        if (orcamentoAny && typeof orcamentoAny === 'string') {
            const cleanedString = orcamentoAny.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
            const numericOrcamento = parseFloat(cleanedString);
            if (!isNaN(numericOrcamento)) {
                parsedResponse.updatedPreferencias.orcamento = numericOrcamento;
            } else {
                delete parsedResponse.updatedPreferencias.orcamento;
            }
        }
        
        if (!parsedResponse.updatedPreferencias.perfilPC) parsedResponse.updatedPreferencias.perfilPC = {} as PerfilPCDetalhado;
        if (!parsedResponse.updatedPreferencias.ambiente) parsedResponse.updatedPreferencias.ambiente = {} as Ambiente;

        return parsedResponse;

    } catch (error) {
        console.error("Erro ao chamar API Gemini (conductAnamnesis):", error);
        // Lidar com o erro de forma apropriada
        throw error;
    }
};

/**
 * Gera uma nova build ou atualiza uma existente com base nas preferências do usuário.
 * @param userInput - A última mensagem do usuário (ou um comando como 'GENERATE_INITIAL_BUILD').
 * @param currentPreferencias - O objeto completo com as preferências do usuário.
 * @param availableComponents - A lista de componentes de hardware disponíveis.
 * @param currentBuild - A build atual, se estiver no modo de edição. Nulo para a geração inicial.
 * @returns Um objeto contendo a nova build, a justificativa e a resposta da IA.
 */
export const generateOrUpdateBuild = async (
    userInput: string,
    currentPreferencias: PreferenciaUsuarioInput,
    availableComponents: Componente[],
    currentBuild: Build | null
): Promise<BuildResponse | null> => {
    if (!API_KEY) {
        console.error("API Key do Gemini não configurada.");
        return null;
    }

    const smartFilteredComponents = preFilterComponents(availableComponents, currentPreferencias.orcamento);
    const componentSummary = smartFilteredComponents.map(c => ({
        id: c.id,
        Produto: c.Produto,
        Preco: c.Preco,
        Categoria: c.Categoria,
    }));

    const isInitialGeneration = !currentBuild;
    const mode = isInitialGeneration ? "GERAÇÃO INICIAL" : "EDIÇÃO DE BUILD";

    const systemInstruction = `Você é CodeTuga, um especialista em montagem de PCs. Sua tarefa agora é construir ou modificar uma build.
**Modo Atual:** ${mode}

**Sua Missão:**
1.  **Analisar e Atualizar:** Analise a mensagem do usuário e as \`currentPreferencias\`. Atualize o objeto \`PreferenciaUsuarioInput\` se necessário.
2.  **Selecionar Componentes:** Com base nas preferências ATUALIZADAS, selecione um conjunto COMPLETO e COMPATÍVEL da lista \`availableComponents\`.
    -   **REGRA DE OURO:** Sempre selecione UM de cada categoria essencial: 'Processadores', 'Placas-Mãe', 'Memória RAM', 'SSD', 'Fonte', 'Gabinete'.
    -   'Placa de Vídeo' é OBRIGATÓRIA, a menos que o CPU tenha vídeo integrado e o propósito não seja jogos/edição pesada.
    -   'Cooler' é crucial para CPUs de alto desempenho ('K', 'X', i7/i9, R7/R9) ou climas quentes.
    -   Se o usuário informou \`ownedComponents\`, você DEVE usar essas peças e NÃO selecionar novas para essas categorias. Garanta 100% de compatibilidade com as peças do usuário.
3.  **Responder ao Usuário:** Elabore uma resposta amigável e informativa sobre a build gerada ou as modificações feitas.

**Formato da Saída (JSON OBRIGATÓRIO):**
\`\`\`json
{
  "aiResponseText": "Sua mensagem de confirmação ou resposta sobre a alteração.",
  "updatedPreferencias": { /* O objeto PreferenciaUsuarioInput COMPLETO e ATUALIZADO */ },
  "recommendedComponentIds": ["id_processador", "id_placa_mae", ...],
  "justification": "Forneça um resumo geral sobre a build, seus pontos fortes e propósito. Se houver QUALQUER aviso de compatibilidade (ex: gargalo de CPU/GPU, TDP da fonte próximo do limite, etc.), liste-os CLARAMENTE sob um título 'Avisos de Compatibilidade:'. Ex: 'Visão Geral: ...\\n\\nAvisos de Compatibilidade:\\n- A fonte de 650W é suficiente, mas um upgrade para 750W é recomendado para futuras atualizações.'",
  "estimatedTotalPrice": 1234.56
}
\`\`\`

**Contexto Atual:**
- Preferências do Usuário: ${JSON.stringify(currentPreferencias)}
${currentBuild ? `- Build Atual para Edição: ${JSON.stringify(currentBuild.componentes.map(c => c.Produto))}` : ''}
- Componentes Disponíveis: ${JSON.stringify(componentSummary, null, 2)}
`;

    try {
        const userMessageForPrompt = userInput === 'GENERATE_INITIAL_BUILD'
            ? "Gere a build inicial com base nas preferências fornecidas."
            : `Última mensagem do usuário pedindo uma alteração: "${userInput}"`;

        const contents: Content[] = [{ role: 'user', parts: [{ text: userMessageForPrompt }] }];

        const result: GenerateContentResponse = await ai.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            },
        });

        const parsedResponse = parseJsonFromGeminiResponse<BuildResponse>(result.text);

        if (!parsedResponse || !parsedResponse.aiResponseText || !parsedResponse.updatedPreferencias || !parsedResponse.recommendedComponentIds) {
            console.error("Resposta da IA (Build) está malformada ou incompleta.", result.text);
            return null;
        }

        // Sanitiza o orçamento, se necessário
        const orcamentoAny = (parsedResponse.updatedPreferencias as any).orcamento;
        if (orcamentoAny && typeof orcamentoAny === 'string') {
            const cleanedString = orcamentoAny.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
            const numericOrcamento = parseFloat(cleanedString);
            if (!isNaN(numericOrcamento)) {
                parsedResponse.updatedPreferencias.orcamento = numericOrcamento;
            } else {
                delete parsedResponse.updatedPreferencias.orcamento;
            }
        }
        
        if (!parsedResponse.updatedPreferencias.perfilPC) parsedResponse.updatedPreferencias.perfilPC = {} as PerfilPCDetalhado;
        if (!parsedResponse.updatedPreferencias.ambiente) parsedResponse.updatedPreferencias.ambiente = {} as Ambiente;
        
        return parsedResponse;

    } catch (error) {
        console.error("Erro ao chamar API Gemini (generateOrUpdateBuild):", error);
        const typedError = error as any;
        const isRateLimitError = (typedError?.error?.code === 429) || String(error).includes('429');
        
        if (isRateLimitError) {
          throw new Error("Estou recebendo muitas solicitações no momento. Por favor, aguarde alguns instantes antes de tentar novamente.");
        }
        throw new Error("Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
    }
};

/**
 * @file Serviço de Interação com a API Google Gemini.
 * @module services/geminiService
 * @description
 * Este módulo encapsula toda a lógica de comunicação com a API Google Gemini.
 * Ele é responsável por construir prompts, enviar requisições para o modelo de IA,
 * e processar as respostas para a montagem de PCs em tempo real.
 */

// Importa os tipos e classes necessários do SDK do Google GenAI e dos tipos locais.
import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { PreferenciaUsuarioInput, ChatMessage, Componente, AIRecommendation, Ambiente, PerfilPCDetalhado, Build } from '../types';

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
 * @interface GeminiLiveBuildResponse
 * @description Define a estrutura JSON esperada da resposta do chatbot Gemini durante a montagem ao vivo.
 */
interface GeminiLiveBuildResponse {
  /** Ação que a UI deve tomar, como pedir permissão de localização. */
  actionRequired?: 'request_location_permission' | 'none';
  /** A resposta de texto da IA a ser exibida para o usuário. */
  aiResponseText: string;
  /** O objeto de preferências do usuário, atualizado pela IA com as novas informações. */
  updatedPreferencias: PreferenciaUsuarioInput;
  /** Flag que indica se a coleta de dados (anamnese) foi concluída. */
  isAnamnesisComplete: boolean;
  /** Um array de IDs dos componentes recomendados. Preenchido apenas na resposta final. */
  recommendedComponentIds?: string[];
  /** Justificativa geral para a build. Preenchida apenas na resposta final. */
  justification?: string;
  /** O preço total estimado da build. Preenchido apenas na resposta final. */
  estimatedTotalPrice?: number;
}


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
    // Tentativa de fallback para um erro comum da IA: inserir um '}' extra antes de uma vírgula.
    // Exemplo: ... "chave": "valor" }, "proximaChave": "valor" ...
    // Esta regex substitui '},' por ',', o que pode consertar objetos malformados.
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
 * Obtém a próxima resposta do chatbot e uma build atualizada em tempo real.
 * Esta é a função central que impulsiona a conversa interativa.
 * @param {ChatMessage[]} history - Histórico de mensagens da conversa.
 * @param {string} userInput - A última mensagem enviada pelo usuário.
 * @param {PreferenciaUsuarioInput} currentPreferencias - O estado atual das preferências coletadas.
 * @param {Componente[]} availableComponents - A lista de componentes disponíveis para seleção.
 * @returns {Promise<GeminiLiveBuildResponse | null>} Um objeto contendo a resposta da IA, preferências atualizadas e a build recomendada.
 * @throws {Error} Lança um erro se houver um erro na comunicação com a API Gemini, incluindo erros de limite de taxa.
 */
export const getLiveBuildResponse = async (
  history: ChatMessage[],
  userInput: string,
  currentPreferencias: PreferenciaUsuarioInput,
  availableComponents: Componente[]
): Promise<GeminiLiveBuildResponse | null> => {
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

    const isStartingConversation = userInput === 'INICIAR_CONVERSA';
    const historyTextLower = history.map(h => h.text).join('\n').toLowerCase();
    const locationAlreadyHandled = !!currentPreferencias.ambiente?.cidade || historyTextLower.includes('não permitiu detecção automática') || historyTextLower.includes('não foi possível detectar');

    const systemInstruction = `Você é CodeTuga, um especialista em montagem de PCs. Sua tarefa é interativamente coletar os requisitos do usuário antes de montar um PC.

**Processo em Duas Fases:**

**Fase 1: Anamnese (Coleta de Dados)**
1.  **Converse e Atualize:** Seu ÚNICO objetivo nesta fase é conversar com o usuário para preencher o objeto \`PreferenciaUsuarioInput\`. Em CADA turno, analise a mensagem do usuário, o histórico e o \`currentPreferencias\` e atualize o objeto \`PreferenciaUsuarioInput\` com as novas informações. NÃO remova dados existentes.
2.  **Siga o Fluxo:** Faça a próxima pergunta lógica seguindo o "Fluxo de Perguntas".
3.  **NÃO GERE A BUILD:** Durante esta fase, no JSON de resposta, \`isAnamnesisComplete\` DEVE ser \`false\`. Os campos \`recommendedComponentIds\`, \`justification\`, e \`estimatedTotalPrice\` DEVEM ser omitidos ou nulos.

**Fluxo de Perguntas (Siga esta ordem estritamente):**
*   SE \`!orcamento\` E \`!orcamentoRange\`, pergunte pelo orçamento.
*   SENÃO, SE \`!perfilPC.purpose\`, pergunte pelo propósito principal.
*   SENÃO, SE (propósito é 'Jogos' E \`!perfilPC.gamingType\`), pergunte pelo tipo de jogo.
*   SENÃO, SE (propósito é 'Trabalho/Produtividade' E \`!perfilPC.workField\`), pergunte pela área de trabalho.
*   SENÃO, SE (propósito é 'Edição Criativa' E \`!perfilPC.creativeEditingType\`), pergunte pelo tipo de edição.
*   SENÃO, SE \`!ownedComponents\`, pergunte se o usuário já possui alguma peça.
*   SENÃO, SE ${!locationAlreadyHandled}, peça permissão para detectar a localização. **Ao fazer esta pergunta, defina "actionRequired": "request_location_permission"**.
*   SENÃO, SE \`!preferences\`, pergunte por outras preferências (estética, ruído, etc.).
*   SENÃO (TODOS os dados essenciais acima foram coletados), a anamnese está completa. Mude para a Fase 2.

**Fase 2: Geração da Build (APENAS no turno final)**
1.  **Indique a Conclusão:** Quando todos os dados do "Fluxo de Perguntas" forem coletados, sua próxima resposta DEVE ter \`isAnamnesisComplete: true\`.
2.  **Gere a Build:** APENAS NESTA RESPOSTA FINAL, você deve:
    a.  Selecionar um conjunto COMPLETO e COMPATÍVEL de componentes da lista \`availableComponents\`.
    b.  Preencher \`recommendedComponentIds\` com os IDs dos componentes.
    c.  Preencher \`justification\` com um resumo e avisos de compatibilidade, sob um título 'Avisos de Compatibilidade:'.
    d.  Preencher \`estimatedTotalPrice\` com o custo total.
    e.  Sua \`aiResponseText\` deve ser uma mensagem de conclusão, como "Com base em tudo que conversamos, esta é a build que montei para você. O que acha?".

**Formato da Saída (JSON OBRIGATÓRIO):**
\`\`\`json
{
  "actionRequired": "none",
  "isAnamnesisComplete": false,
  "aiResponseText": "Sua próxima pergunta ou a mensagem de conclusão.",
  "updatedPreferencias": { /* O objeto PreferenciaUsuarioInput COMPLETO e ATUALIZADO */ },
  "recommendedComponentIds": null,
  "justification": null,
  "estimatedTotalPrice": null
}
\`\`\`

**Regras para a Build (na Fase 2):**
- **SEMPRE selecione UM de cada categoria essencial:** 'Processadores', 'Placas-Mãe', 'Memória RAM', 'SSD', 'Fonte', 'Gabinete'.
- 'Placa de Vídeo' é OBRIGATÓRIA, a menos que o propósito seja servidor/escritório e o CPU tenha vídeo integrado.
- 'Cooler' é crucial para CPUs de alto desempenho ('K', 'X', i7/i9, R7/R9) ou climas quentes.
- Se o usuário informou \`ownedComponents\`, você DEVE usar essas peças e NÃO selecionar novas para essas categorias. Garanta 100% de compatibilidade.

**Contexto Atual:**
- Objeto \`currentPreferencias\`: ${JSON.stringify(currentPreferencias)}
- Componentes Disponíveis: ${JSON.stringify(componentSummary, null, 2)}
`;

    try {
        const userMessageForPrompt = isStartingConversation
            ? "A conversa está apenas começando. Siga o 'Fluxo de Perguntas' e faça a primeira pergunta."
            : `Última mensagem do usuário: "${userInput}"\n\nCom base nisso, no contexto e no histórico, gere o JSON de resposta seguindo todas as instruções.`;

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
        
        const parsedResponse = parseJsonFromGeminiResponse<GeminiLiveBuildResponse>(result.text);

        if (!parsedResponse || !parsedResponse.aiResponseText || !parsedResponse.updatedPreferencias) {
            console.error("Resposta da IA está malformada ou incompleta.", result.text);
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
        console.error("Erro ao chamar API Gemini (getLiveBuildResponse):", error);
        const typedError = error as any;
        const isRateLimitError = (typedError?.error?.code === 429) || String(error).includes('429');
        
        if (isRateLimitError) {
          throw new Error("Estou recebendo muitas solicitações no momento. Por favor, aguarde alguns instantes antes de tentar novamente.");
        }
        throw new Error("Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.");
    }
};
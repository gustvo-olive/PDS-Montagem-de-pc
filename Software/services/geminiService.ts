
import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { PreferenciaUsuarioInput, ChatMessage, Componente, AIRecommendation, Ambiente, PerfilPCDetalhado } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is não está configurada. Por favor, defina a variável de ambiente process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "NO_KEY_PROVIDED" }); 
const TEXT_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

// Esta interface define a estrutura JSON esperada da resposta da IA do chatbot.
interface GeminiChatResponse {
  aiResponseText: string;
  updatedPreferencias: PreferenciaUsuarioInput;
}

const parseJsonFromGeminiResponse = <T,>(responseText: string): T | null => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }

  // Lida com casos onde o modelo pode adicionar texto explicativo antes ou depois do bloco JSON.
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Falha ao analisar resposta JSON do Gemini:", e, "\nResposta Bruta:", responseText, "\nString Analisada:", jsonStr);
    return null;
  }
};


export const getChatbotResponse = async (
  history: ChatMessage[],
  userInput: string,
  currentPreferencias: PreferenciaUsuarioInput
): Promise<{ aiResponse: string; updatedPreferencias: PreferenciaUsuarioInput }> => {
  if (!API_KEY) return { aiResponse: "Desculpe, o serviço de IA não está configurado corretamente (sem API Key).", updatedPreferencias: currentPreferencias };

  const isStartingConversation = userInput === 'INICIAR_CONVERSA';

  const chatHistoryForGemini: Content[] = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  let weatherInfoForSystem = "";
  if (currentPreferencias.ambiente?.cidade && currentPreferencias.ambiente?.temperaturaMediaCidade !== undefined) {
    weatherInfoForSystem = `\nINFORMAÇÃO CLIMÁTICA DISPONÍVEL: Dados para ${currentPreferencias.ambiente.cidade}: Temp. Média ${currentPreferencias.ambiente.temperaturaMediaCidade}°C. Considere isso para refrigeração. O usuário já forneceu a localização.`;
  }
  
  const historyTextLower = history.map(h => h.text).join('\n').toLowerCase();
  const userDeniedLocation = historyTextLower.includes('não permitiu detecção automática');
  const locationFailed = historyTextLower.includes('não foi possível detectar');
  const locationAlreadyHandled = !!currentPreferencias.ambiente?.cidade || userDeniedLocation || locationFailed;

  const systemInstruction = `Você é CodeTuga, um assistente especialista em montagem de PCs. Sua tarefa é coletar os requisitos do usuário (PreferenciaUsuarioInput) de forma interativa e retornar um JSON com o estado atualizado e a próxima pergunta.

**Instruções Principais:**
1.  Analise o histórico da conversa, a última mensagem do usuário (se houver) e o objeto JSON \`currentPreferencias\` fornecido.
2.  Extraia TODAS as informações relevantes da última resposta do usuário.
3.  Atualize o objeto JSON \`currentPreferencias\` para criar o \`updatedPreferencias\`. **NÃO** remova informações já coletadas, apenas adicione ou modifique. Mantenha a estrutura do objeto.
4.  Siga o "Fluxo de Perguntas" ABAIXO para determinar qual é a próxima pergunta lógica a ser feita. A ordem é CRÍTICA.
5.  Sua resposta DEVE ser um único bloco de código JSON válido, sem nenhum texto, markdown, ou explicações antes ou depois.

**Fluxo de Perguntas (SIGA ESTA ORDEM EXATAMENTE):**
*   **SE** \`!orcamento\` e \`!orcamentoRange\`, pergunte: "Para começarmos, qual é a sua faixa de orçamento em Reais (BRL)? (Ex: Econômico [até R$4000], Médio [R$4000-R$8000], ou um valor específico)".
*   **SENÃO, SE** \`!perfilPC.purpose\`, pergunte: "Ótimo. E qual será o propósito principal do seu PC? (Ex: Jogos, Trabalho/Produtividade, Edição Criativa, Uso Geral)".
*   **SENÃO, SE** \`perfilPC.purpose === 'Jogos'\` e \`!perfilPC.gamingType\`, pergunte: "Perfeito para jogos! Que tipo de games você mais joga? (Ex: Competitivos/eSports, AAA/High-End, VR, Casual)".
*   **SENÃO, SE** \`perfilPC.purpose === 'Trabalho/Produtividade'\` e \`!perfilPC.workField\`, pergunte: "Entendido. E em qual área você trabalha? (Ex: Desenvolvimento, Design Gráfico, Engenharia/3D, Ciência de Dados)".
*   **SENÃO, SE** \`perfilPC.purpose === 'Edição Criativa'\` e \`!perfilPC.creativeEditingType\`, pergunte: "Legal! Qual tipo de edição criativa você faz? (Ex: Vídeo, Foto, Áudio, 3D)".
*   **SENÃO, SE** ${!locationAlreadyHandled}, pergunte: "Excelente. Para otimizar a refrigeração, você permite que eu detecte sua localização para verificar o clima local? Isso ajuda a escolher o cooler ideal.".
*   **SENÃO, SE** \`!preferences\`, pergunte: "Estamos quase lá! Você tem alguma outra preferência importante? (Ex: estética com muito RGB, um gabinete pequeno, um sistema super silencioso, marcas preferidas, etc.)".
*   **SENÃO (TODOS os dados acima coletados)**, use a \`aiResponseText\` para confirmar os dados e perguntar se pode gerar a build. Exemplo: "Ok, revisei tudo: um PC para [Propósito] na faixa de [Orçamento]. Posso gerar uma recomendação de build com base nisso?".

**Formato da Saída (JSON OBRIGATÓRIO):**
\`\`\`json
{
  "aiResponseText": "Sua próxima pergunta ou a mensagem de validação final vai aqui.",
  "updatedPreferencias": {
    /* A versão MAIS RECENTE e COMPLETA do objeto PreferenciaUsuarioInput vai aqui. */
  }
}
\`\`\`

**Contexto da Conversa Atual:**
- Objeto \`currentPreferencias\` atual: ${JSON.stringify(currentPreferencias)}
${weatherInfoForSystem}
`;

  try {
    const userMessageForPrompt = isStartingConversation
      ? "A conversa está apenas começando. Siga o 'Fluxo de Perguntas' e faça a primeira pergunta ao usuário."
      : `Última mensagem do usuário: "${userInput}"\n\nCom base no contexto e histórico, gere o JSON de resposta seguindo o fluxo de perguntas.`;
      
    const contents: Content[] = [...chatHistoryForGemini, { role: 'user', parts: [{ text: userMessageForPrompt }] }];
    
    const result: GenerateContentResponse = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      },
    });
    
    const parsedResponse = parseJsonFromGeminiResponse<GeminiChatResponse>(result.text);

    if (!parsedResponse || !parsedResponse.aiResponseText || !parsedResponse.updatedPreferencias) {
        console.error("Resposta da IA está malformada ou incompleta.", result.text);
        return { aiResponse: "Não entendi bem. Poderia reformular?", updatedPreferencias: currentPreferencias };
    }

    // Garante que a estrutura aninhada exista se a IA a omitir
    if (!parsedResponse.updatedPreferencias.perfilPC) {
        parsedResponse.updatedPreferencias.perfilPC = {} as PerfilPCDetalhado;
    }
    if (!parsedResponse.updatedPreferencias.ambiente) {
        parsedResponse.updatedPreferencias.ambiente = {} as Ambiente;
    }

    return { aiResponse: parsedResponse.aiResponseText, updatedPreferencias: parsedResponse.updatedPreferencias };

  } catch (error) {
    console.error("Erro ao chamar API Gemini (getChatbotResponse):", error);
    const typedError = error as any;
    if (typedError?.error?.code === 429 || String(typedError).includes('429')) {
      return { 
        aiResponse: "Estou recebendo muitas solicitações no momento. Por favor, aguarde alguns instantes antes de tentar novamente.", 
        updatedPreferencias: currentPreferencias 
      };
    }
    return { aiResponse: "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.", updatedPreferencias: currentPreferencias };
  }
};


export const preFilterComponents = (components: Componente[], budget?: number): Componente[] => {
    const COMPONENT_COUNT_PER_CATEGORY = 15;

    if (!budget || budget <= 0) {
        const maxComponents = COMPONENT_COUNT_PER_CATEGORY * 8; // ~120 components
        if (components.length <= maxComponents) return components;
        const shuffled = [...components].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxComponents);
    }

    const budgetDistribution: Record<string, number> = {
        'Processadores': 0.20,
        'Placas de Vídeo': 0.35,
        'Placas-Mãe': 0.12,
        'Memória RAM': 0.08,
        'SSD': 0.08,
        'Fonte': 0.07,
        'Gabinete': 0.05,
        'Cooler': 0.05,
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

    console.log(`Pre-filtering reduced components from ${components.length} to ${finalFilteredComponents.size}`);
    return Array.from(finalFilteredComponents.values());
};


export const getBuildRecommendation = async (
  requisitos: PreferenciaUsuarioInput,
  availableComponents: Componente[]
): Promise<AIRecommendation | null> => {
  if (!API_KEY) {
    console.error("API Key do Gemini não configurada para getBuildRecommendation");
    return null;
  }
  
  const smartFilteredComponents = preFilterComponents(availableComponents, requisitos.orcamento);

  const componentSummary = smartFilteredComponents.map(c => ({
    id: c.id,
    Produto: c.Produto,
    Preco: c.Preco,
    Categoria: c.Categoria,
  }));

  const prompt = `
Você é um especialista em montagem de PCs. Sua tarefa é recomendar uma build otimizada com base nos seguintes requisitos e na lista de componentes disponíveis.

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

Componentes Disponíveis (ID, Nome do Produto, Preço, Categoria):
${JSON.stringify(componentSummary, null, 2)}

Instruções CRÍTICAS e OBRIGATÓRIAS:
1.  **ANÁLISE E SELEÇÃO:** Sua tarefa é analisar a lista de "Componentes Disponíveis". Cada componente já possui um campo 'Categoria' definido. Você DEVE usar este campo para a seleção.
    a.  **Use a Categoria Fornecida:** NÃO tente inferir a categoria do nome do produto. O campo 'Categoria' é a fonte da verdade.
    b.  **Analise o 'Produto':** Dentro de cada categoria, analise o nome do 'Produto' para entender as especificações (ex: "Core i5-14600K", "DDR5", "RTX 4060") e garantir a compatibilidade.

2.  **REGRAS DE SELEÇÃO DE COMPONENTES:** Monte uma build completa e compatível.
    -   **Essenciais (SEMPRE inclua UM de cada):** 'Processadores', 'Placas-Mãe', 'Memória RAM', 'SSD', 'Fonte', 'Gabinete'. Use as categorias exatas fornecidas.
    -   **Placa de Vídeo:** É OBRIGATÓRIA, a menos que o propósito seja um servidor simples ou um PC de escritório muito básico E o processador escolhido tenha vídeo integrado (inferido do nome, ex: 'Ryzen 5 5600G').
    -   **Cooler:** É ALTAMENTE RECOMENDADO, especialmente para processadores de alto desempenho (inferido do nome, ex: 'Core i7', 'Ryzen 7', ou sufixos 'K', 'X'). Se o orçamento for muito apertado, pode ser omitido se o processador incluir um cooler padrão (ex: 'Ryzen 5 5600').
    -   **HD:** É OPCIONAL. Inclua apenas se o usuário precisar de muito armazenamento e o orçamento permitir, em adição ao SSD.

3.  **COMPATIBILIDADE É REI (REGRA MAIS IMPORTANTE):** A principal prioridade é garantir 100% de compatibilidade. Verifique CUIDADOSAMENTE:
    - **Soquete CPU vs Placa-mãe:** Ex: Um 'Processador Intel LGA1700' DEVE ser pareado com uma 'Placa-Mãe LGA1700'. Um 'Processador AMD AM5' DEVE ser pareado com uma 'Placa-Mãe AM5'.
    - **Tipo de RAM:** Se a Placa-Mãe suporta 'DDR5', a 'Memória RAM' DEVE ser 'DDR5'. Se suporta 'DDR4', a RAM deve ser 'DDR4'. Verifique isso nos nomes dos produtos.
    - **Tamanho (Form Factor):** Uma 'Placa-Mãe ATX' precisa de um 'Gabinete' que suporte ATX (Mid Tower, Full Tower). Uma 'Placa-Mãe Micro-ATX' cabe em gabinetes Micro-ATX ou maiores.
    - **Potência da Fonte:** A 'Fonte' deve ter potência suficiente para todos os componentes, especialmente a Placa de Vídeo e o Processador. Para builds de alto desempenho, prefira fontes de 750W ou mais.

4.  **FOCO NO ORÇAMENTO:** Tente montar a melhor build possível DENTRO do orçamento fornecido. Se não for possível, monte a build mais próxima e explique a situação no campo 'budgetNotes'.

5.  **SAÍDA EM JSON (OBRIGATÓRIO):** Sua resposta DEVE ser um único bloco de código JSON válido, sem nenhum texto, markdown, ou explicações antes ou depois. Não inclua NENHUM comentário ou pensamento dentro do próprio bloco de código JSON. O JSON deve ser estritamente aderente ao formato especificado abaixo:
{
  "recommendedComponentIds": ["id_do_processador", "id_da_placa_mae", ...],
  "justification": "Explicação concisa das suas escolhas, focando em como elas atendem às necessidades e orçamento do usuário e como a compatibilidade foi garantida.",
  "estimatedTotalPrice": 1234.56,
  "budgetNotes": "Se a build exceder o orçamento ou for muito abaixo, explique o porquê aqui. Se o orçamento for adequado, diga 'O orçamento foi bem utilizado'.",
  "compatibilityWarnings": ["Se houver alguma pequena dúvida ou observação sobre compatibilidade (ex: 'Pode ser necessário atualizar a BIOS da placa-mãe'), liste aqui. Se não houver, deixe um array vazio []."]
}
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
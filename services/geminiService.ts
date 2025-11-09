import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { 
    Composicao, 
    ComposicaoInsumo, 
    ComposicaoMaoDeObra,
    SearchResult,
    Insumo,
    Service,
    Doubt,
    InternalQuery,
    ApprovalStatus,
    RefinementSuggestion,
    ValueEngineeringAnalysis
} from '../types';

let ai: GoogleGenAI | null = null;

// --- TIPOS DE RESPOSTA PARA O ASK H-QUANT ---
export type RespostaDireta = {
  tipoResposta: "resposta_direta";
  texto: string;
};
export type ListaComposicoes = {
  tipoResposta: "lista_composicoes";
  ids: string[];
  textoIntroducao: string;
};
export type RespostaAnalitica = {
  tipoResposta: "resposta_analitica";
  texto: string;
  idsReferenciados: string[];
};
export type NaoEncontrado = {
  tipoResposta: "nao_encontrado";
  texto: string;
};
export type GeminiResponse = RespostaDireta | ListaComposicoes | RespostaAnalitica | NaoEncontrado;


/**
 * Lazily initializes and returns the GoogleGenAI instance.
 * This function ensures the SDK is only instantiated on the client-side when needed.
 */
function getAiInstance() {
    if (ai) {
        return ai;
    }
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
        return ai;
    }
    console.warn("Gemini AI service is not initialized. Make sure the API_KEY environment variable is set.");
    return null;
}

// FIX: Added fileToGenerativePart helper for image analysis
const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
};

// FIX: Implemented analyzeText function
export const analyzeText = async (prompt: string): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return text;
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao analisar texto:", error);
        throw new Error("A IA falhou ao analisar o texto.");
    }
};

// FIX: Implemented analyzeImage function
export const analyzeImage = async (prompt: string, image: File): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const imagePart = await fileToGenerativePart(image);

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, imagePart] },
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return text;
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao analisar imagem:", error);
        throw new Error("A IA falhou ao analisar a imagem.");
    }
};

// FIX: Implemented generateWithSearch function
export const generateWithSearch = async (query: string): Promise<SearchResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `Você é um assistente especialista em engenharia de custos para construção civil chamado "Ask Quantisa". Responda a seguinte pergunta de forma clara e concisa, usando as informações da busca para basear sua resposta. Formate a resposta em HTML, usando listas e negrito quando apropriado. Pergunta: ${query}`;

    try {
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text;

        if (typeof text === 'string') {
            const searchResult: SearchResult = {
                text: text,
                metadata: response.candidates?.[0]?.groundingMetadata,
            };
            return searchResult;
        } else {
            console.error("Resposta da IA inválida ou sem texto para busca:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia durante a busca.");
        }
    } catch (error) {
        console.error("Erro ao gerar resposta com busca:", error);
        return { text: "Ocorreu um erro ao buscar a resposta. Tente novamente." };
    }
};

export const answerQueryFromCompositions = async (query: string, compositions: Composicao[]): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const systemInstruction = `
**1.0 MINHA PERSONA: COMO VOCÊ DEVE ATUAR (DETALHADA)**

Você atuará como **"Ask H-Quant"**, a interface de inteligência do Eng. Marcus Oliveira. Sua persona é a de um **Engenheiro de Custos Sênior, especialista em análise de dados de construção civil**, com uma rigorosa **Visão de Dono**.

**1.1 Princípios Fundamentais (Herdados do Eng. Marcus):**

*   **Consultor Técnico, Não um Chatbot Genérico:** Sua função é extrair insights técnicos e financeiros da base de dados de composições. Cada resposta deve ser precisa, justificada e, se possível, quantificada.
*   **Fonte Única da Verdade:** Sua única fonte de conhecimento é a base de dados de composições fornecida. **Você NUNCA deve inventar ou inferir informações que não estejam explicitamente nos dados.** Se a resposta não existe, afirme isso claramente.
*   **Comunicação Estruturada:** Responda de forma organizada, usando listas, negrito e tabelas simples (se necessário) para apresentar a informação de forma clara e profissional.
*   **Foco em Mitigação de Riscos:** Ao analisar os dados, se você identificar uma premissa de risco em uma composição (ex: "NÃO INCLUSO: Locação de andaimes"), você pode sutilmente mencioná-la em sua resposta se for relevante para a pergunta do usuário.

**2.0 ESTRUTURA DOS DADOS: O PADRÃO QUANTISA V1.2.1**

Você receberá uma base de dados de composições que seguem uma estrutura detalhada de 7 seções. É crucial que você entenda o que cada seção significa para encontrar a informação correta:
*   **Cabeçalho:** Título, Unidade, Grupo.
*   **Seção 1 (Premissas):** O que é, como é feito, o que está incluso e o que NÃO está.
*   **Seção 2 (Insumos):** Consumo de materiais e equipamentos POR UNIDADE.
*   **Seção 3 (Mão de Obra):** Produtividade (HH/unidade) por função.
*   **Seção 4 (Consolidados):** Lista de compra total e HH total para a quantidade de referência.
*   **Seção 5 (Indicadores):** Custos totais (R$/unidade) e outros indicadores como peso e entulho. **Este é um campo chave para perguntas sobre custos.**
*   **Seção 7 (Análise do Engenheiro):** Justificativas técnicas, fontes e comparações com o mercado (SINAPI/TCPO).
    `;
    
    const prompt = `
**3.0 SUA TAREFA: ANÁLISE DE INTENÇÃO E RESPOSTA ESTRUTURADA**

Você receberá uma "Pergunta do Usuário" e a "Base de Dados de Composições". Sua tarefa é:
1.  Analisar a **intenção** da pergunta.
2.  Consultar a base de dados para encontrar a(s) composição(ões) mais relevante(s).
3.  Extrair a informação precisa.
4.  Formular uma resposta em um dos formatos JSON pré-definidos abaixo.

**4.0 TIPOS DE RESPOSTA E ESTRUTURA DE SAÍDA (TYPESCRIPT)**

Analise a pergunta do usuário e retorne **APENAS UM ÚNICO OBJETO JSON VÁLIDO** que corresponda a um dos seguintes tipos:

\`\`\`typescript
type RespostaDireta = {
  tipoResposta: "resposta_direta";
  texto: string; // Resposta textual direta. Ex: "Para a composição 'X', o consumo de cimento é de Y."
};

type ListaComposicoes = {
  tipoResposta: "lista_composicoes";
  ids: string[]; // Array de IDs das composições encontradas.
  textoIntroducao: string; // Frase inicial. Ex: "Encontrei 3 composições para 'alvenaria':"
};

type RespostaAnalitica = {
  tipoResposta: "resposta_analitica";
  texto: string; // Resposta elaborada baseada na Seção 7 (Análise do Engenheiro).
  idsReferenciados: string[]; // IDs das composições usadas para a análise.
};

type NaoEncontrado = {
  tipoResposta: "nao_encontrado";
  texto: string; // Mensagem informando que a resposta não foi encontrada na base.
};

type GeminiResponse = RespostaDireta | ListaComposicoes | RespostaAnalitica | NaoEncontrado;
\`\`\`

**5.0 REGRAS DE ANÁLISE**

*   **Pergunta de Fato Específico ("Qual o consumo...", "Qual o custo..."):** Use \`RespostaDireta\`. Encontre a composição, extraia o dado (da Seção 2, 3 ou 5) e formule o \`texto\`.
*   **Pergunta de Listagem ("Quais são...", "Me mostre tudo sobre..."):** Use \`ListaComposicoes\`. Encontre todos os IDs relevantes e formule o \`textoIntroducao\`.
// FIX: The expression "7(...)" was being parsed as a function call, causing a syntax error. Rephrased the text to be syntactically correct while preserving meaning for the model prompt.
*   **Pergunta Aberta ou Analítica ("Por que...", "Qual a mais produtiva..."):** Use \`RespostaAnalitica\`. Baseie sua resposta na Seção 7 de Análise do Engenheiro e inclua os \`idsReferenciados\`.
*   **Pergunta Fora de Escopo ("Qual o preço do dólar?"):** Use \`NaoEncontrado\`.
*   **Ambiguidade:** Se a pergunta for ambígua e puder se referir a múltiplas composições (ex: "Qual o custo da alvenaria?"), prefira a resposta do tipo \`ListaComposicoes\` para que o usuário possa escolher.

**6.0 DADOS PARA ANÁLISE**

*   **PERGUNTA DO USUÁRIO:** "${query}"
*   **BASE DE DADOS DE COMPOSIÇÕES:** ${JSON.stringify(compositions)}
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
            }
        });
        // Remove potential markdown fences for cleaner parsing
        const text = response.text;
        if (typeof text === 'string') {
            const cleanedText = text.replace(/```json\n?|\n?```/g, '');
            return cleanedText;
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao buscar nas composições:", error);
        throw new Error("A IA falhou ao buscar na base de dados de composições.");
    }
};


// FIX: Implemented parseInsumos function
export const parseInsumos = async (text: string): Promise<Partial<Insumo>[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**AÇÃO:** Você é um especialista em análise de dados de engenharia. Sua tarefa é receber um texto bruto contendo uma lista de insumos e extrair CADA item em um objeto JSON estruturado.

**REGRAS:**
1.  **EXTRAÇÃO COMPLETA:** Analise cada linha. Ignore linhas vazias ou de comentário.
2.  **INTERPRETAÇÃO INTELIGENTE:**
    *   **Nome:** Extraia o nome principal do insumo.
    *   **Marca:** Se uma marca for mencionada (ex: "Votoran", "Quartzolit", "similar"), extraia para o campo 'marca'. Se não houver, deixe nulo.
    *   **Unidade:** Extraia a unidade de medida (ex: "kg", "m³", "un", "L").
    *   **Custo:** Extraia o valor numérico do custo. Converta vírgulas para pontos.
    *   **Tipo:** Classifique o insumo como 'Material', 'MaoObra' ou 'Equipamento'.
    *   **Observação:** Se a IA fizer alguma suposição ou encontrar algo ambíguo, adicione uma nota curta no campo 'observacao'.

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
Retorne um array de objetos JSON. Cada objeto deve seguir esta estrutura:
\`\`\`json
{
  "nome": "string",
  "unidade": "string",
  "custo": number,
  "tipo": "'Material' | 'MaoObra' | 'Equipamento'",
  "marca": "string | null",
  "observacao": "string | null"
}
\`\`\`

            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        let textToParse = response.text;
        if (typeof textToParse !== 'string') {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textToParse.match(jsonRegex);
        if (match && match[1]) {
            textToParse = match[1];
        }

        const parsedData = JSON.parse(textToParse);
        if (Array.isArray(parsedData)) {
            return parsedData;
        }
        
        throw new Error("A IA não retornou um array de insumos no formato esperado.");
    } catch (error) {
        console.error("Erro ao processar insumos:", error);
        throw new Error("Não foi possível interpretar o texto dos insumos. Verifique o formato e tente novamente.");
    }
};

// FIX: Implemented BatchSimilarityResult type
export type BatchSimilarityResult = {
    newInsumoId: string;
    existingInsumoId: string;
    similarityScore: number; // 0-100
    reasoning: string;
};

type ParsedInsumoForPrompt = { id: string; nome?: string; marca?: string; };
type ExistingInsumoForPrompt = { id: string; nome: string; marca?: string; };

// FIX: Implemented findSimilarInsumosInBatch function
export const findSimilarInsumosInBatch = async (
    newInsumos: ParsedInsumoForPrompt[],
    existingInsumos: ExistingInsumoForPrompt[]
): Promise<BatchSimilarityResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newInsumos.length === 0 || existingInsumos.length === 0) {
        return [];
    }
    
    const prompt = `
**AÇÃO:** Você é um especialista em "Entity Resolution" para bancos de dados de insumos de construção. Sua tarefa é comparar um lote de novos insumos com uma lista de insumos existentes e identificar possíveis duplicatas.

**REGRAS DE COMPARAÇÃO:**
1.  **FOCO SEMÂNTICO:** Compare pelo significado, não apenas pelo texto exato. "Cimento CPII" é o mesmo que "Cimento CP-II".
2.  **MARCA É IMPORTANTE:** "Cimento Votoran" e "Cimento Campeão" são o mesmo insumo base, mas de marcas diferentes. Considere-os similares, mas não idênticos.
3.  **SCORE DE SIMILARIDADE:** Atribua um score de 0 a 100. Acima de 85 é uma forte candidata a duplicata.
4.  **JUSTIFICATIVA:** Explique brevemente por que você considera os itens similares.

**DADOS DE ENTRADA:**
- **newInsumos:** lexible[ { "id": "temp-1", "nome": "Cimento CP-II Votoran" }, ... ]\n- **existingInsumos:** lexible[ { "id": "db-123", "nome": "Cimento Portland CP II", "marca": "Votoran" }, ... ]

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
Retorne um array de objetos. Cada objeto representa um par similar encontrado. Se um novo insumo for similar a múltiplos existentes, retorne o par com maior score. Se nenhum par for similar o suficiente (score > 70), não o inclua na resposta.

\`\`\`json
[
  {
    "newInsumoId": "string",
    "existingInsumoId": "string",
    "similarityScore": number,
    "reasoning": "string"
  }
]
\`\`\`

**TAREFA:**
Analise os seguintes dados e retorne os pares similares:

**New Insumos:**
${JSON.stringify(newInsumos)}

**Existing Insumos:**
${JSON.stringify(existingInsumos)}
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let textToParse = response.text;
        if (typeof textToParse !== 'string') {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textToParse.match(jsonRegex);
        if (match && match[1]) {
            textToParse = match[1];
        }
        
        const results: BatchSimilarityResult[] = JSON.parse(textToParse);
        if (Array.isArray(results)) {
            return results;
        }
        
        return [];
    } catch (error) {
        console.error("Erro ao verificar similaridade de insumos:", error);
        return [];
    }
};

// FIX: Implemented getDetailedScope function
export const getDetailedScope = async (
    services: Service[],
    doubts: Doubt[],
    clientAnswers: string
): Promise<{
    detailedServices: Service[];
    pendingDoubts: Doubt[];
    internalQueries: InternalQuery[];
}> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");
    
    const prompt = `
**PERSONA:** Engenheiro de Custos Sênior com "Visão de Dono".

**TAREFA:** Sua função é atuar como um "motor de clareza". Você receberá uma lista de serviços preliminares, uma lista de dúvidas técnicas que você mesmo gerou anteriormente, e as respostas que o cliente forneceu. Seu objetivo é cruzar essas informações para criar uma lista de serviços detalhada e acionável.

**DADOS DE ENTRADA:**
1.  **Serviços Preliminares:** ${JSON.stringify(services)}
2.  **Dúvidas Geradas:** ${JSON.stringify(doubts)}
3.  **Respostas do Cliente:** "${clientAnswers}"

**REGRAS DE PROCESSAMENTO:**
1.  **DETALHAMENTO:** Para cada serviço preliminar, use as respostas do cliente para adicionar uma descrição detalhada. Se a resposta esclarece uma dúvida sobre um serviço, incorpore essa informação na descrição do serviço correspondente. Ex: Se a dúvida era "Qual a espessura do contrapiso?" e a resposta foi "5cm", o serviço "Execução de contrapiso" deve ter em sua descrição "Execução de contrapiso com espessura de 5cm...".
2.  **IDENTIFICAR DÚVIDAS PENDENTES:** Se uma dúvida crucial não foi respondida ou a resposta foi ambígua, adicione-a à lista de 'pendingDoubts'.
3.  **GERAR CONSULTAS INTERNAS:** Se a resposta do cliente for vaga mas você PODE tomar uma decisão padrão de mercado para não parar o orçamento, crie uma "consulta interna". Isso é uma premissa que você está adotando, que precisará ser validada. Ex: Se a resposta for "use a tinta padrão", sua consulta interna pode ser: "Premissa Adotada: Foi especificada a utilização de tinta acrílica fosca branca, padrão Suvinil ou similar. Confirmar se este padrão é aceitável."
4.  **QUANTIDADES "VERBA":** Se um serviço tem quantidade 0 ou unidade 'vb'/'verba', mantenha-o, mas adicione uma observação de que precisa ser quantificado.

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
Retorne APENAS um objeto JSON com a seguinte estrutura:
\`\`\`json
{
  "detailedServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ],
  "pendingDoubts": [ { "id": "string", "question": "string" }, ... ],
  "internalQueries": [ { "id": "string", "query": "string" }, ... ]
}
\`\`\`
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return JSON.parse(text);
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao detalhar escopo:", error);
        throw new Error("A IA falhou ao gerar o escopo detalhado.");
    }
};

type QueryResponse = {
    query: InternalQuery;
    status: ApprovalStatus;
    comment: string;
};

// FIX: Implemented processQueryResponses function
export const processQueryResponses = async (
    queryResponses: QueryResponse[],
    currentServices: Service[]
): Promise<{ newServices: Service[], newObservations: string[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**PERSONA:** Engenheiro de Custos Sênior.

**TAREFA:** Você receberá uma lista de "consultas internas" (premissas que a IA adotou) e a resposta do engenheiro (aprovada/rejeitada + comentário). Sua tarefa é interpretar essas respostas e, se necessário, gerar novos serviços ou observações para o projeto.

**DADOS DE ENTRADA:**
1.  **Respostas às Consultas:** ${JSON.stringify(queryResponses)}
2.  **Serviços Atuais:** ${JSON.stringify(currentServices)}

**REGRAS:**
- Se uma consulta foi **aprovada**, não faça nada, a premissa é válida.
- Se uma consulta foi **rejeitada** com um comentário, você DEVE agir:
    - Se o comentário for uma **correção simples** (ex: "Usar tinta acetinada ao invés de fosca"), gere uma **observação** para o projeto.
    - Se o comentário introduz um **novo trabalho** (ex: "Além da pintura, precisamos incluir a remoção da textura existente"), gere um **novo serviço** na lista 'newServices'.
    - Use o bom senso de engenharia.

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
\`\`\`json
{
  "newServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ],
  "newObservations": ["string", ...]
}
\`\`\`
    `;
    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return JSON.parse(text);
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao processar respostas de consulta:", error);
        throw new Error("A IA falhou ao processar as respostas.");
    }
};

// FIX: Implemented refineScopeFromEdits function
export const refineScopeFromEdits = async (
    currentServices: Service[],
    instruction: string
): Promise<{ updatedServices: Service[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**PERSONA:** Assistente de Engenharia de Custos.

**TAREFA:** Você receberá uma lista de serviços e uma instrução de edição. Modifique a lista de serviços conforme a instrução. Você pode adicionar, remover ou modificar serviços.

**DADOS DE ENTRADA:**
1.  **Serviços Atuais:** ${JSON.stringify(currentServices)}
2.  **Instrução de Edição:** "${instruction}"

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
Retorne a lista completa de serviços, com as modificações aplicadas.
\`\`\`json
{
  "updatedServices": [ { "id": "string", "nome": "string", "description": "string", "quantidade": number, "unidade": "string" }, ... ]
}
\`\`\`
    `;
    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return JSON.parse(text);
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao refinar escopo com edições:", error);
        throw new Error("A IA falhou ao refinar o escopo.");
    }
};

// FIX: Implemented getValueEngineeringAnalysis function
export const getValueEngineeringAnalysis = async (
    services: Service[]
): Promise<{ valueEngineeringAnalysis: ValueEngineeringAnalysis[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**PERSONA:** Engenheiro de Valor Estratégico.

**TAREFA:** Analise a lista de serviços de um projeto e identifique os 2-3 itens com maior potencial de otimização (custo, prazo, performance). Para cada item, proponha 2-3 alternativas, comparando-as de forma clara.

**DADOS DE ENTRADA:**
- **Serviços:** ${JSON.stringify(services)}

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
\`\`\`json
{
  "valueEngineeringAnalysis": [
    {
      "itemId": "string (ID do serviço original)",
      "itemName": "string (Nome do serviço original)",
      "options": [
        {
          "solution": "string (Descrição da solução alternativa)",
          "relativeCost": "string (Ex: '10% mais barato', 'Custo similar', '25% mais caro')",
          "deadlineImpact": "string (Ex: 'Reduz em 2 dias', 'Sem impacto', 'Aumenta em 1 semana')",
          "pros": ["string", ...],
          "cons": ["string", ...],
          "recommendation": "string (Recomendação técnica da IA)"
        },
        ...
      ]
    },
    ...
  ]
}
\`\`\`
`;
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return JSON.parse(text);
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
};

// FIX: Implemented getRefinementSuggestions function
export const getRefinementSuggestions = async (
    pendingDoubts: Doubt[]
): Promise<{ refinementSuggestions: RefinementSuggestion[] }> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    if (pendingDoubts.length === 0) {
        return { refinementSuggestions: [] };
    }

    const prompt = `
**PERSONA:** Assistente de Orçamentista.

**TAREFA:** Você receberá uma lista de dúvidas técnicas que ainda não foram respondidas. Para cada dúvida, gere 2-3 respostas de múltipla escolha que sejam as mais comuns ou prováveis em um cenário de construção civil. Para cada resposta, adicione uma 'tag' curta indicando o impacto (ex: "+Custo", "-Prazo", "Padrão").

**DADOS DE ENTRADA:**
- **Dúvidas Pendentes:** ${JSON.stringify(pendingDoubts)}

**ESTRUTURA JSON DE SAÍDA OBRIGATÓRIA:**
\`\`\`json
{
  "refinementSuggestions": [
    {
      "doubtId": "string (ID da dúvida original)",
      "question": "string (Texto da dúvida original)",
      "suggestedAnswers": [
        { "answer": "string", "tag": "string", "actionType": "'modify' | 'add'" },
        ...
      ]
    },
    ...
  ]
}
\`\`\`
`;
    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        if (typeof text === 'string') {
            return JSON.parse(text);
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao gerar sugestões de refinamento:", error);
        throw new Error("A IA falhou ao gerar as sugestões de refinamento.");
    }
};

export type ParsedComposicao = Omit<Composicao, 'id' | 'codigo'>;


export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
**1.0 PERSONA E OBJETIVOS ESTRATÉGICOS**

Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente. Seus princípios de atuação são:

*   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes.
*   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
*   Consultor, Não Calculista: Você atua como um consultor técnico, explicando o "porquê" de cada decisão, sinalizando riscos e guiando para a melhor solução.

**2.0 TAREFA PRINCIPAL**

Sua função é receber um texto de entrada e seu objetivo principal é sempre retornar um array de objetos JSON perfeitamente estruturados no formato Composicao final definido na Seção 4.0.

**3.0 REGRAS DE ADAPTAÇÃO E PARSING (REVISADAS E REFORÇADAS)**

*   **3.1. Regra de Validação de Entrada (PRIORIDADE MÁXIMA):**
    *   Primeiro, analise o texto de entrada. Se o texto for manifestamente inválido (curto, aleatório, sem nenhuma palavra-chave como "custo", "material", "serviço", "m²", etc.), sua tarefa é parar imediatamente. Neste caso, gere uma notaDaImportacao com a mensagem de erro: 'Alerta: O texto fornecido não parece ser uma composição de serviço. Não foi possível extrair dados. Por favor, verifique o texto e tente novamente.' e retorne um objeto Composicao com campos vazios ou nulos. NÃO tente criar uma composição a partir de um texto sem sentido.

*   **3..2. Lógica de Processamento e Extração Completa:**
    *   Se a entrada for válida, prossiga. É mandatório que você tente extrair todas as 7 seções do padrão, se presentes.
    *   Se o texto de entrada já estiver no formato "Composição Padrão Quantisa", faça o parsing direto.
    *   Se o texto estiver em um formato desconhecido, ative seu modo de adaptação inteligente.

*   **3.3. Transparência e Sugestão de Código (Regras Obrigatórias):**
    *   **Seja Conciso na notaDaImportacao:** Foque em resumir as principais adaptações e nos alertas de maior risco.
    *   **Sugira o Código (OBRIGATÓRIO):** Analise o título e os insumos e, na notaDaImportacao, sugira um Grupo e um Subgrupo.
    *   **Preencha os Campos de Grupo/Subgrupo:** Os valores que você sugerir para Grupo e Subgrupo devem também ser usados para preencher os campos grupo e subgrupo no objeto Composicao principal.

*   **3.4. Formatação de Saída (REGRAS ESPECÍFICAS COM EXEMPLOS):**
    *   **Fontes e Referências (Seção 7.2):** Ao gerar o texto para o campo analiseEngenheiro.fontesReferencias, formate-o obrigatoriamente com quebras de linha (duplo \n para criar um novo parágrafo) e negrito (**) em Markdown. O título de cada coeficiente deve estar em uma nova linha. Siga os exemplos abaixo rigorosamente:
        *   **Exemplo 1 (Contrapiso):**
            \`\`\`markdown
            **Coeficientes de Consumo:** Traço de argamassa baseado em tabelas de referência (TCPO). Consumo de aditivo baseado em ficha técnica (Vedacit).

            **Coeficientes de Produtividade:** Índice de 1,20 HH/m² mantido da composição original, considerado adequado por envolver duas etapas distintas.
            \`\`\`
        *   **Exemplo 2 (Alvenaria):**
            \`\`\`markdown
            **Coeficientes de Consumo:** Consumo de blocos conforme padrão de mercado (12,5 un/m²). Traços de argamassa e concreto baseados em TCPO.

            **Coeficientes de Produtividade:** Índice de 1,40 HH/m² mantido, considerado conservador e adequado à complexidade e ao risco do trabalho em altura.
            \`\`\`

    *   **Quadro de Produtividade (Seção 7.3):** Para o campo \`analiseEngenheiro.quadroProdutividade\`, formate **SEMPRE** a saída como uma tabela Markdown simples e válida.
        *   **REGRAS OBRIGATÓRIAS PARA A TABELA:**
            1.  **CONTEÚDO MÍNIMO:** A tabela DEVE conter, no mínimo, **duas (2) linhas de dados**: a primeira linha para o \`**Índice Adotado**\` e a segunda (e subsequentes) para **pelo menos uma referência de mercado** (ex: SINAPI, TCPO, ou outra fonte pertinente).
            2.  **COMPARAÇÃO É ESSENCIAL:** O objetivo principal deste quadro é a **comparação**. Se você não encontrar uma referência direta, use uma referência de um serviço similar e justifique na \`nota\` da Análise do Engenheiro.
            3.  **PROIBIÇÃO:** **NÃO GERE UMA TABELA COM APENAS UMA LINHA DE DADOS.** Isso é considerado uma falha crítica.
            4.  **FORMATAÇÃO:** Siga os exemplos abaixo **rigorosamente**. NUNCA retorne este campo como texto contínuo ou \`[Object Object]\`.

        *   **EXEMPLOS (SEGUIR ESTRUTURA):**
            *   Exemplo 1 (Alvenaria):
                \`\`\`markdown
                | Fonte de Referência | Produtividade (HH/m²) | Custo M.O. (R$/m²) | Variação vs. Adotado |
                | :--- | :--- | :--- | :--- |
                | **Índice Adotado (Total)** | **1,40** | **R$ 43,75** | **-** |
                | SINAPI (Cód. 87282) | 0,71 | R$ 22,19 | -49,29% |
                \`\`\`
            *   Exemplo 2 (Impermeabilização):
                \`\`\`markdown
                | Fonte de Referência | Produtividade (HH/m²) | Custo M.O. (R$/m²) | Variação vs. Adotado |
                | :--- | :--- | :--- | :--- |
                | **Índice Adotado (Profis.+Ajud.)** | **0,87** | **R$ 27,45** | **-** |
                | TCPO (Ref. 04.30.20.15) | 0,75 | R$ 23,44 | -14,62% |
                \`\`\`

**4.0 ESTRUTURA DE DADOS ALVO (JSON de Saída)**

Sua saída deve aderir estritamente à seguinte estrutura TypeScript. Sempre retorne um array \`[]\`, mesmo que ele contenha apenas um único objeto.

\`\`\`typescript
export interface ComposicaoInsumo {
  item: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  pesoUnitario?: number;
  pesoTotal?: number;
}
export interface ComposicaoMaoDeObra {
  funcao: string;
  hhPorUnidade: number;
  custoUnitario: number;
  custoTotal: number;
}
export interface ComposicaoListaCompraItem {
    item: string;
    unidadeCompra: string;
    quantidadeBruta: number;
    quantidadeAComprar: number;
    custoTotalEstimado: number;
}
export interface ComposicaoIndicadorMaoDeObra {
    funcao: string;
    hhPorUnidade: number;
    hhTotal: number;
}
export interface ComposicaoIndicadores {
  custoMateriais_porUnidade: number;
  custoEquipamentos_porUnidade: number;
  custoMaoDeObra_porUnidade: number;
  custoDiretoTotal_porUnidade: number;
  custoMateriais_total: number;
  custoEquipamentos_total: number;
  custoMaoDeObra_total: number;
  custoDiretoTotal_total: number;
  maoDeObraDetalhada: ComposicaoIndicadorMaoDeObra[];
  pesoMateriais_porUnidade: number;
  pesoMateriais_total: number;
  volumeEntulho_porUnidade: number;
  volumeEntulho_total: number;
}
export interface Composicao {
  codigo: string;
  titulo: string;
  unidade: string;
  quantidadeReferencia: number;
  grupo: string;
  subgrupo: string;
  tags: string[];
  classificacaoInterna: string;
  premissas: { escopo: string; metodo: string; incluso: string; naoIncluso: string; };
  insumos: { materiais: ComposicaoInsumo[]; equipamentos: ComposicaoInsumo[]; };
  maoDeObra: ComposicaoMaoDeObra[];
  quantitativosConsolidados: {
      listaCompraMateriais: ComposicaoListaCompraItem[];
      necessidadeEquipamentos: any[];
      quadroMaoDeObraTotal: any[];
  };
  indicadores: ComposicaoIndicadores;
  guias: { dicasExecucao: string; alertasSeguranca: string; criteriosQualidade: string; };
  analiseEngenheiro: {
    nota: string;
    fontesReferencias: string;
    quadroProdutividade: string;
    analiseRecomendacao: string;
    notaDaImportacao?: string;
  };
}
\`\`\`

**5.0 SAÍDA**

Sua resposta final deve ser um array de objetos \`Composicao\` bem-formado, pronto para ser validado pelo usuário. Não inclua nenhum texto ou explicação adicional fora da estrutura JSON solicitada.
    `;

    const fullPrompt = `${prompt}\n\n---\nTexto para Análise:\n---\n${text}`;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        let textToParse = response.text;
        if (typeof textToParse !== 'string') {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        
        const parsedData = JSON.parse(textToParse);
        
        // Enhanced validation
        if (Array.isArray(parsedData)) {
            return parsedData;
        }

        // Handle case where AI returns a single object instead of an array of one
        if (typeof parsedData === 'object' && parsedData !== null && 'titulo' in parsedData) {
            return [parsedData];
        }

        // Handle case where AI wraps the array in an object, e.g. { "key": [...] }
        if (typeof parsedData === 'object' && parsedData !== null) {
            const keys = Object.keys(parsedData);
            if (keys.length > 0 && Array.isArray(parsedData[keys[0]])) {
                return parsedData[keys[0]];
            }
        }

        throw new Error("A IA não retornou um array de composições no formato esperado.");

    } catch (error) {
        console.error("Erro ao processar composições:", error);
        throw new Error("Não foi possível interpretar o texto da composição. Verifique o formato e tente novamente.");
    }
};

export const reviseParsedComposition = async (composition: ParsedComposicao, instruction: string): Promise<ParsedComposicao> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
        **PERSONA:** Você é um assistente de IA especialista em correção de dados estruturados.
        
        **AÇÃO:** Sua tarefa é revisar um objeto JSON de composição de serviço que foi parseado incorretamente, usando as instruções do usuário para corrigi-lo. Retorne APENAS o objeto JSON corrigido.

        **CONTEXTO:**
        - **JSON Incorreto:** ${JSON.stringify(composition)}
        - **Instruções de Correção do Usuário:** "${instruction}"

        **FORMATO DE SAÍDA OBRIGATÓRIO:**
        Retorne APENAS o objeto JSON corrigido. Não adicione nenhum texto, explicação ou formatação adicional antes ou depois do objeto JSON. Sua resposta deve ser diretamente parseável.
    `;

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            // FIX: Simplified 'contents' from [{ parts: [{ text: prompt }], role: 'user' }] to just prompt string for single-turn text.
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let textToParse = response.text;
        if (typeof textToParse !== 'string') {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = textToParse.match(jsonRegex);
        if (match && match[1]) {
            textToParse = match[1];
        }

        const parsedData: ParsedComposicao = JSON.parse(textToParse);
        
        // Basic validation
        if (!parsedData.titulo) {
             throw new Error("A IA retornou um objeto de composição inválido.");
        }

        return parsedData;

    } catch (error) {
        console.error("Erro ao revisar composição:", error);
        throw new Error("Não foi possível aplicar a correção na composição.");
    }
}

export interface BatchRelevanceResult {
  idNovaComposicao: string; // ID temporário da composição importada
  candidatos: {
    idExistente: string;     // ID da composição existente que é similar
    titulo: string;          // Título da composição existente
    escopoResumido: string;  // Resumo do escopo da composição existente
    relevanciaScore: number; // Score de 0 a 100
    motivo: string;          // Breve explicação da IA
  }[];
}


export const findRelevantCompositionsInBatch = async (newCompositions: (ParsedComposicao & { id: string })[], existingCompositions: Composicao[]): Promise<BatchRelevanceResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newCompositions.length === 0) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }
     if (existingCompositions.length === 0) {
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }

    const newCompositionsForPrompt = newCompositions.map(c => ({ id: c.id, titulo: c.titulo }));
    const existingCompositionsForPrompt = existingCompositions.map(c => ({ id: c.id, titulo: c.titulo, escopo: c.premissas.escopo }));


    const prompt = `
**1.0 PERSONA E OBJETIVO ESTRATÉGICO**
Você atuará com uma persona híbrida e de alta especialização: um **Engenheiro de Custos Sênior com "Visão de Dono"** que também é um **Analista de Dados Sênior**, focado em saneamento e normalização de bancos de dados de engenharia. Seus princípios são:
*   **Precisão do Engenheiro:** Você entende o contexto de uma obra. Sua análise vai além do texto e considera a aplicabilidade prática. Erros de especificação (ex: tipo de cimento, resistência de concreto) são inaceitáveis.
*   **Rigor do Analista:** Você aplica técnicas de "Entity Resolution" de forma sistemática para identificar duplicatas semânticas, ignorando ruídos de formatação e sintaxe.
*   **Eficiência de Escala:** Sua missão é processar lotes de dados de forma rápida e precisa, fornecendo um resultado claro e acionável.
Seu objetivo final é ser a principal linha de defesa contra a poluição de dados em um sistema de orçamentação, garantindo que a base de composições seja íntegra, confiável e livre de duplicatas.

**2.0 TAREFA**
Você receberá um lote de "Novas Composições" e uma lista de "Composições Existentes". Para CADA nova composição, sua tarefa é encontrar as 5 composições existentes mais relevantes, ordená-las por relevância, e retornar os resultados em uma estrutura JSON consolidada. Para cada candidato, você deve incluir o texto COMPLETO do seu campo de escopo.

**3.0 DADOS DE ENTRADA (Exemplo de formato que você receberá)**
\`\`\`json
{
  "newCompositions": [
    { "id": "temp-1", "titulo": "Contrapiso c/ argamassa pronta (e=4cm)" },
    { "id": "temp-2", "titulo": "Demolição de parede de alvenaria" }
  ],
  "existingCompositions": [
    { "id": "db-101", "titulo": "Execução de Contrapiso (e=4cm) sobre Enchimento", "escopo": "Execução de contrapiso com argamassa industrializada para nivelamento de base, com espessura final de 4cm, sobre camada de enchimento leve existente. Não inclui a preparação da base." },
    { "id": "db-102", "titulo": "Enchimento Leve de Piso - EPS 10cm + Contrapiso 5cm", "escopo": "Sistema completo de regularização de piso, incluindo camada de 10cm de EPS e posterior contrapiso de 5cm de espessura." },
    { "id": "db-103", "titulo": "Demolição Manual de Alvenaria de Tijolos", "escopo": "Demolição manual de paredes de alvenaria de vedação com tijolos cerâmicos, sem aproveitamento. Inclui a remoção do material para área de descarte." }
  ]
}
\`\`\`

**4.0 REGRAS DE ANÁLISE DE RELEVÂNCIA (SEGUIR COM RIGOR)**
*   **Pré-Filtro de Categoria:** Primeiro, identifique a categoria principal do serviço (ex: Contrapiso, Alvenaria, Demolição). Compare apenas composições da mesma categoria para evitar resultados absurdos.
*   **Análise Semântica:** Dê alta relevância para títulos que compartilham especificações técnicas chave (espessuras, materiais, métodos). A ordem das palavras não importa.
*   **Penalização por Conflito Técnico:** Se dois títulos são semanticamente similares mas possuem uma especificação técnica **conflitante** (ex: "Contrapiso 4cm" vs "Contrapiso 5cm"), o score deve ser **significativamente reduzido**. Eles são relacionados, mas não são substitutos diretos.
*   **Score:** Atribua um \`relevanciaScore\` de 0 a 100.
*   **Motivo:** Forneça uma explicação curta e objetiva para cada candidato, justificando o score e comparando os pontos-chave. Ex: "Mesmo serviço (sóculo), mas material diferente (Bloco de Concreto vs. Bloco Cerâmico) e altura conflitante (15cm vs 19cm)."

**5.0 SAÍDA ESPERADA (Formato JSON OBRIGATÓRIO)**
Retorne um objeto JSON contendo uma chave "resultados" que é um array de objetos, um para cada nova composição analisada. Se para uma nova composição nenhum candidato for encontrado, retorne um array vazio de candidatos para ela.

\`\`\`json
{
  "resultados": [
    {
      "idNovaComposicao": "temp-1",
      "candidatos": [
        { "idExistente": "db-101", "titulo": "Execução de Contrapiso (e=4cm) sobre Enchimento", "escopoResumido": "Execução de contrapiso com argamassa industrializada para nivelamento de base, com espessura final de 4cm, sobre camada de enchimento leve existente. Não inclui a preparação da base.", "relevanciaScore": 98, "motivo": "Mesmo serviço e espessura (4cm)." },
        { "idExistente": "db-102", "titulo": "Enchimento Leve de Piso - EPS 10cm + Contrapiso 5cm", "escopoResumido": "Sistema completo de regularização de piso, incluindo camada de 10cm de EPS e posterior contrapiso de 5cm de espessura.", "relevanciaScore": 75, "motivo": "Serviço relacionado, mas com espessura (5cm vs 4cm) e método diferentes." }
      ]
    },
    {
      "idNovaComposicao": "temp-2",
      "candidatos": [
        { "idExistente": "db-103", "titulo": "Demolição Manual de Alvenaria de Tijolos", "escopoResumido": "Demolição manual de paredes de alvenaria de vedação com tijolos cerâmicos, sem aproveitamento. Inclui a remoção do material para área de descarte.", "relevanciaScore": 95, "motivo": "Mesmo serviço de demolição de alvenaria." }
      ]
    }
  ]
}
\`\`\`
    `;
    
    const payload = {
        newCompositions: newCompositionsForPrompt,
        existingCompositions: existingCompositionsForPrompt,
    };

    const fullPrompt = `${prompt}\n\n---\nEntrada JSON:\n---\n${JSON.stringify(payload, null, 2)}`;
    
     try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const textToParse = response.text;
        if (typeof textToParse !== 'string') {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        const parsedData = JSON.parse(textToParse);

        if (parsedData && Array.isArray(parsedData.resultados)) {
            // Fallback for escopoResumido if AI fails to provide it
            return parsedData.resultados.map((res: any) => ({
                ...res,
                candidatos: res.candidatos.map((cand: any) => ({
                    ...cand,
                    escopoResumido: cand.escopoResumido || "Não foi possível extrair o escopo."
                }))
            }));
        }

        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));

    } catch (error) {
        console.error("Erro ao buscar composições relevantes em lote:", error);
        return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
    }
}

export const exportCompositionToMarkdown = (composition: Composicao): string => {
    let markdown = 
    ``;

    const createTable = (headers: string[], rows: (string|number)[][]) => {
        if (rows.length === 0) return 'N/A\n';
        let table = `| ${headers.join(' | ')} |
`;
        table += `|${headers.map(() => ' :--- ').join('|')}|
`;
        rows.forEach(row => {
            table += `| ${row.join(' | ')} |
`;
        });
        return table;
    };

    markdown += `# 1.0 METADADOS\n`;
    markdown += `**Título:** ${composition.titulo || ''}\n`;
    markdown += `**Unidade:** ${composition.unidade || ''}\n`;
    markdown += `**Quantidade de Referência:** ${composition.quantidadeReferencia || 1}\n\n`;

    markdown += `# 2.0 PREMISSAS TÉCNICAS E DE ESCOPO\n`;
    markdown += `**Escopo:** ${composition.premissas?.escopo || ''}\n`;
    markdown += `**Método:** ${composition.premissas?.metodo || ''}\n`;
    markdown += `**Incluso:** ${composition.premissas?.incluso || ''}\n`;
    markdown += `**Não Incluso:** ${composition.premissas?.naoIncluso || ''}\n\n`;

    markdown += `# 3.0 LISTA DE INSUMOS E MÃO DE OBRA (para 1,00 ${composition.unidade})\n\n`;
    
    markdown += `## 3.1 Materiais\n`;
    const materialRows = composition.insumos?.materiais?.map(i => [i.item, i.unidade, i.quantidade.toFixed(4), i.valorUnitario.toFixed(2), i.valorTotal.toFixed(2)]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], materialRows) + '\n';
    
    markdown += `## 3.2 Equipamentos\n`;
    const equipRows = composition.insumos?.equipamentos?.map(i => [i.item, i.unidade, i.quantidade.toFixed(4), i.valorUnitario.toFixed(2), i.valorTotal.toFixed(2)]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], equipRows) + '\n';

    markdown += `## 3.3 Mão de Obra\n`;
    const moRows = (composition.maoDeObra || []).map(mo => [mo.funcao, mo.hhPorUnidade.toFixed(4), mo.custoUnitario.toFixed(2), mo.custoTotal.toFixed(2)]);
    markdown += createTable(['Função', 'HH/Unidade', 'Custo Unit.', 'Custo Total'], moRows) + '\n\n';

    markdown += `# 4.0 GUIAS, SEGURANÇA E QUALIDADE\n`;
    markdown += `**Dicas de Execução:** ${composition.guias?.dicasExecucao || ''}\n`;
    markdown += `**Alertas de Segurança:** ${composition.guias?.alertasSeguranca || ''}\n`;
    markdown += `**Critérios de Qualidade:** ${composition.guias?.criteriosQualidade || ''}\n\n`;

    markdown += `# 5.0 ANÁLISE TÉCNICA DO ENGENHEIRO\n`;
    markdown += `**Nota:** ${composition.analiseEngenheiro?.nota || ''}\n\n`;
    markdown += `**Fontes e Referências:**\n${composition.analiseEngenheiro?.fontesReferencias || ''}\n\n`;
    markdown += `**Quadro de Produtividade:**\n${composition.analiseEngenheiro?.quadroProdutividade || ''}\n\n`;
    markdown += `**Análise e Recomendação:** ${composition.analiseEngenheiro?.analiseRecomendacao || ''}\n`;

    return markdown;
};
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { 
    Composicao, 
    SearchResult,
    Insumo,
    Service,
    Doubt,
    InternalQuery,
    ApprovalStatus,
    RefinementSuggestion,
    ValueEngineeringAnalysis
} from '../types';

// Definição única e correta para o resultado do parsing
export type ParsedComposicao = Partial<Omit<Composicao, 'id'>>;

let ai: GoogleGenerativeAI | null = null;

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
 * Lazily initializes and returns the GoogleGenerativeAI instance.
 * This function ensures the SDK is only instantiated on the client-side when needed.
 */
function getAiInstance() {
    if (ai) {
        return ai;
    }
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
        ai = new GoogleGenerativeAI(apiKey);
        return ai;
    }
    console.warn("Gemini AI service is not initialized. Make sure the API_KEY environment variable is set.");
    return null;
}

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

export const analyzeText = async (prompt: string): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
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

export const analyzeImage = async (prompt: string, image: File): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const imagePart = await fileToGenerativePart(image);

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([{ text: prompt }, imagePart]);
        const response = result.response;
        const text = response.text();
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

export const generateWithSearch = async (query: string): Promise<SearchResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `Você é um assistente especialista em engenharia de custos para construção civil chamado "Ask Quantisa". Responda a seguinte pergunta de forma clara e concisa, usando as informações da busca para basear sua resposta. Formate a resposta em HTML, usando listas e negrito quando apropriado. Pergunta: ${query}`;

    try {
        const model = aiInstance.getGenerativeModel({ 
            model: 'gemini-1.5-flash'
        });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

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

export const answerQueryFromCompositions = async (query: string, compositions: Composicao[]): Promise<GeminiResponse> => {
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
Você receberá uma base de dados de composições que seguem uma estrutura detalhada. É crucial que você entenda o que cada seção significa para encontrar a informação correta:
*   **Cabeçalho:** Título, Unidade, Grupo.
*   **Seção 1 (Premissas):** O que é, como é feito, o que está incluso e o que NÃO está.
*   **Seção 2 (Insumos):** Consumo de materiais e equipamentos POR UNIDADE.
*   **Seção 3 (Mão de Obra):** Produtividade (HH/unidade) por função.
*   **Seção 5 (Indicadores):** Custos totais (R$/unidade) e outros indicadores como peso e entulho. **Este é um campo chave para perguntas sobre custos.**
*   **Seção 7 (Análise do Engenheiro):** Justificativas técnicas e comparações com o mercado (SINAPI/TCPO).
    `;
    
    const prompt = `
**3.0 SUA TAREFA: ANÁLISE DE INTENÇÃO E RESPOSTA ESTRUTURADA**
Você receberá uma "Pergunta do Usuário" e a "Base de Dados de Composições". Sua tarefa é analisar a intenção da pergunta, consultar a base de dados e formular uma resposta em um dos formatos JSON pré-definidos abaixo.

**4.0 TIPOS DE RESPOSTA E ESTRUTURA DE SAÍDA (TYPESCRIPT)**
Analise a pergunta do usuário e retorne **APENAS UM ÚNICO OBJETO JSON VÁLIDO** que corresponda a um dos seguintes tipos:

\`\`\`typescript
type RespostaDireta = { tipoResposta: "resposta_direta"; texto: string; };
type ListaComposicoes = { tipoResposta: "lista_composicoes"; ids: string[]; textoIntroducao: string; };
type RespostaAnalitica = { tipoResposta: "resposta_analitica"; texto: string; idsReferenciados: string[]; };
type NaoEncontrado = { tipoResposta: "nao_encontrado"; texto: string; };
\`\`\`

**5.0 REGRAS DE ANÁLISE**
*   **Pergunta de Fato Específico ("Qual o consumo...", "Qual o custo..."):** Use \`RespostaDireta\`.
*   **Pergunta de Listagem ("Quais são...", "Me mostre tudo sobre..."):** Use \`ListaComposicoes\`.
*   **Pergunta Aberta ou Analítica ("Por que...", "Qual a mais produtiva..."):** Use \`RespostaAnalitica\`. Baseie sua resposta na Seção 7 (Análise do Engenheiro).
*   **Pergunta Fora de Escopo:** Use \`NaoEncontrado\`.
*   **Ambiguidade:** Se a pergunta for ambígua (ex: "Qual o custo da alvenaria?"), prefira \`ListaComposicoes\` para que o usuário possa escolher.

**6.0 DADOS PARA ANÁLISE**
*   **PERGUNTA DO USUÁRIO:** "${query}"
*   **BASE DE DADOS DE COMPOSIÇÕES:** ${JSON.stringify(compositions)}
    `;

    try {
        const model = aiInstance.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: systemInstruction 
        });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        if (typeof text === 'string') {
            const cleanedText = text.replace(/```json\n?|\n?```/g, '');
            return JSON.parse(cleanedText) as GeminiResponse;
        } else {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
    } catch (error) {
        console.error("Erro ao buscar nas composições:", error);
        throw new Error("A IA falhou ao buscar na base de dados de composições.");
    }
};

// ====================================================================================================
// FUNÇÃO parseCompositions CORRIGIDA E ROBUSTA
// ====================================================================================================

export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    if (!text || text.trim().length < 50) { // Limite de 50 caracteres
        throw new Error("O texto fornecido é muito curto ou inválido para ser uma composição.");
    }

    const prompt = `
        **1.0 PERSONA E OBJETIVOS**
        Você é um Engenheiro de Custos Sênior focado em extrair dados de textos e convertê-los em um formato JSON preciso.

        **2.0 TAREFA**
        Sua tarefa é receber um texto de entrada e retornar um array de objetos JSON, com UM objeto por composição. Preencha apenas os campos que você conseguir extrair diretamente do texto. **NÃO FAÇA CÁLCULOS**.

        **3.0 REGRAS**
        - Foco em Extração, Não em Cálculo: Sua responsabilidade é IDENTIFICAR e EXTRAIR. Deixe campos calculáveis (como totais ou indicadores) como 0, null, ou simplesmente não os inclua.
        - Formato de Saída: Sua resposta DEVE estar encapsulada em um bloco de código Markdown JSON (ex: \`\`\`json ... \`\`\`).

        **4.0 ESTRUTURA DE DADOS ALVO (O "MAPA")**
        Preencha apenas os campos que conseguir extrair do texto, seguindo esta estrutura simplificada:
        \`\`\`json
        {
          "codigo": "string",
          "titulo": "string",
          "unidade": "string",
          "quantidadeReferencia": "number",
          "grupo": "string",
          "subgrupo": "string",
          "tags": ["string"],
          "premissas": { "escopo": "string", "metodo": "string", "incluso": "string", "naoIncluso": "string" },
          "insumos": { "materiais": [{ "item": "string", "unidade": "string", "quantidade": "number", "valorUnitario": "number" }], "equipamentos": [] },
          "maoDeObra": [{ "funcao": "string", "hhPorUnidade": "number", "custoUnitario": "number" }],
          "analiseEngenheiro": { "nota": "string", "fontesReferencias": "string", "quadroProdutividade": "string", "analiseRecomendacao": "string" }
        }
        \`\`\`
    `;

    const fullPrompt = `${prompt}\n\n---\nTexto para Análise:\n---\n${text}`;

    try {
        const aiInstance = getAiInstance();
        if (!aiInstance) throw new Error("IA não configurada.");

        const model = aiInstance.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const responseText = response.text();

        if (!responseText) {
            console.error("Resposta da IA inválida ou sem texto:", response);
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }

        let textToParse = responseText;

        // --- LÓGICA ROBUSTA DE EXTRAÇÃO DE JSON (SEM REGEX) ---
        const jsonStartMarker = "```json";
        const jsonEndMarker = "```";
        let startIndex = textToParse.indexOf(jsonStartMarker);
        if (startIndex !== -1) {
            startIndex += jsonStartMarker.length;
            const endIndex = textToParse.lastIndexOf(jsonEndMarker);
            if (endIndex > startIndex) {
                textToParse = textToParse.slice(startIndex, endIndex).trim();
            }
        }
        // --- FIM DA LÓGICA DE EXTRAÇÃO ---

        const parsedData = JSON.parse(textToParse);

        if (Array.isArray(parsedData)) {
            return parsedData as ParsedComposicao[];
        }
        if (typeof parsedData === 'object' && parsedData !== null) {
            return [parsedData as ParsedComposicao];
        }
        throw new Error("A IA não retornou um array ou objeto de composições válido.");

    } catch (error) {
        console.error("Erro ao processar composições:", error);
        throw new Error("Não foi possível interpretar o texto da composição. Verifique o formato, a resposta da IA e tente novamente.");
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
        const model = aiInstance.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const response = result.response;
        let textToParse = response.text();

        if (typeof textToParse !== 'string') {
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        
        const jsonStartMarker = "```json";
        const jsonEndMarker = "```";
        let startIndex = textToParse.indexOf(jsonStartMarker);
        if (startIndex !== -1) {
            startIndex += jsonStartMarker.length;
            const endIndex = textToParse.lastIndexOf(jsonEndMarker);
            if (endIndex > startIndex) {
                textToParse = textToParse.slice(startIndex, endIndex).trim();
            }
        }

        const parsedData: ParsedComposicao = JSON.parse(textToParse);
        
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
  idNovaComposicao: string;
  candidatos: {
    idExistente: string;
    titulo: string;
    escopoResumido: string;
    relevanciaScore: number;
    motivo: string;
  }[];
}


export const findRelevantCompositionsInBatch = async (newCompositions: (ParsedComposicao & { id: string })[], existingCompositions: Composicao[]): Promise<BatchRelevanceResult[]> => {
    const aiInstance = getAiInstance();
    if (!aiInstance || newCompositions.length === 0 || existingCompositions.length === 0) {
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
        { "idExistente": "db-101", "titulo": "Execução de Contrapiso (e=4cm) sobre Enchimento", "escopoResumido": "Execução de contrapiso com argamassa industrializada...", "relevanciaScore": 98, "motivo": "Mesmo serviço e espessura (4cm)." }
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
        const model = aiInstance.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const textToParse = response.text();

        if (typeof textToParse !== 'string') {
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        const parsedData = JSON.parse(textToParse);

        if (parsedData && Array.isArray(parsedData.resultados)) {
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
    let markdown = ``;

    const createTable = (headers: string[], rows: (string|number)[][]) => {
        if (!rows || rows.length === 0) return 'N/A\n';
        let table = `| ${headers.join(' | ')} |\n`;
        table += `|${headers.map(() => ' :--- ').join('|')}|\n`;
        rows.forEach(row => {
            table += `| ${row.join(' | ')} |\n`;
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

    markdown += `# 3.0 LISTA DE INSUMOS E MÃO DE OBRA (para 1,00 ${composition.unidade || 'unidade'})\n\n`;
    
    markdown += `## 3.1 Materiais\n`;
    const materialRows = composition.insumos?.materiais?.map(i => [i.item, i.unidade, i.quantidade, i.valorUnitario, i.valorTotal]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], materialRows) + '\n';
    
    markdown += `## 3.2 Equipamentos\n`;
    const equipRows = composition.insumos?.equipamentos?.map(i => [i.item, i.unidade, i.quantidade, i.valorUnitario, i.valorTotal]) || [];
    markdown += createTable(['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.'], equipRows) + '\n';

    markdown += `## 3.3 Mão de Obra\n`;
    const moRows = (composition.maoDeObra || []).map(mo => [mo.funcao, mo.hhPorUnidade, mo.custoUnitario, mo.custoTotal]);
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
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

// Interface para o resultado da classificação (Movidar para o topo para evitar erros)
export interface ClassificationResult {
  grupo: string;
  subgrupo: string;
  sugestaoCodigo: string;
  justificativa: string;
}

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
 * Inicializa e retorna a instância do GoogleGenerativeAI.
 */
function getAiInstance() {
    if (ai) {
        return ai;
    }
    // Busca a chave com prefixo NEXT_PUBLIC_ para funcionar no front-end
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
        ai = new GoogleGenerativeAI(apiKey);
        return ai;
    }
    console.warn("Gemini AI service is not initialized. Make sure the NEXT_PUBLIC_GEMINI_API_KEY environment variable is set.");
    return null;
}

// ====================================================================================================
// SISTEMA DE RETRY ROBUSTO PARA ERROS TEMPORÁRIOS DA API
// ====================================================================================================

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

/**
 * Sistema de retry com exponential backoff para lidar com erros temporários da API
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Verifica se é um erro que vale a pena tentar novamente
      const shouldRetry = isRetryableError(error);
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Calcula o delay com exponential backoff
      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
      
      console.warn(`Tentativa ${attempt + 1}/${maxRetries + 1} falhou. Tentando novamente em ${delay}ms...`, {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Verifica se o erro é temporário e vale a pena tentar novamente
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const errorMessage = error.message.toLowerCase();
  
  // Lista de erros que são temporários
  const retryablePatterns = [
    'overloaded',
    'service unavailable',
    '503',
    '429',
    'too many requests',
    'rate limit',
    'quota exceeded',
    'internal error',
    'timeout',
    'network error',
    'connection reset'
  ];
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
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

// ====================================================================================================
// FUNÇÕES AUXILIARES DE LIMPEZA DE JSON
// ====================================================================================================

function fixInvalidEscapes(jsonString: string): string {
    return jsonString.replace(/\\(?!["\\/bfnrtu])/g, '');
}

function extractAndCleanJson(text: string): string {
    let textToParse = text;

    // Extração robusta do JSON do bloco de código
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

    // Remove possíveis marcadores residuais
    textToParse = textToParse.replace(/```json|```/g, '').trim();

    // Corrige escapes inválidos
    textToParse = fixInvalidEscapes(textToParse);

    return textToParse;
}

// ====================================================================================================
// FUNÇÕES PRINCIPAIS
// ====================================================================================================

export const analyzeText = async (prompt: string): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await withRetry(() => model.generateContent(prompt));
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
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        throw new Error(`A IA falhou ao analisar o texto: ${errorMessage}`);
    }
};

export const analyzeImage = async (prompt: string, image: File): Promise<string> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const imagePart = await fileToGenerativePart(image);

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await withRetry(() => model.generateContent([{ text: prompt }, imagePart]));
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
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        throw new Error(`A IA falhou ao analisar a imagem: ${errorMessage}`);
    }
};

export const generateWithSearch = async (query: string): Promise<SearchResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `Você é um assistente especialista em engenharia de custos para construção civil chamado "Ask Quantisa". Responda a seguinte pergunta de forma clara e concisa, usando as informações da busca para basear sua resposta. Formate a resposta em HTML, usando listas e negrito quando apropriado. Pergunta: ${query}`;

    try {
        const model = aiInstance.getGenerativeModel({ 
            model: 'gemini-2.5-flash'
        });
        const result = await withRetry(() => model.generateContent(prompt));
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
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return { text: `Ocorreu um erro ao buscar a resposta: ${errorMessage}. Tente novamente.` };
    }
};

export const answerQueryFromCompositions = async (query: string, compositions: Composicao[]): Promise<GeminiResponse> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const systemInstruction = `
**1.0 PERSONA: ASK H-QUANT - SEU ASSISTENTE INTELIGENTE DE COMPOSIÇÕES**

Você é o **"Ask H-Quant"**, o assistente especialista em análise de composições de custos da construção civil. Sua missão é ser **a interface inteligente** que transforma dados brutos em insights acionáveis.

**1.1 PRINCÍPIOS FUNDAMENTAIS:**

* **ESPECIALISTA TÉCNICO:** Você domina todos os aspectos das composições - desde insumos e produtividade até análise de riscos e comparativos de mercado.
* **FONTE ÚNICA DA VERDADE:** Sua base de conhecimento são APENAS as composições fornecidas. Não invente, não suponha, não extrapole.
* **ANALISTA ESTRATÉGICO:** Você vai além de simples respostas - fornece contexto, comparações, insights e identificação de padrões.
* **COMUNICADOR CLARO:** Suas respostas são estruturadas, organizadas e ricas em informações, usando formatação quando apropriado.

**2.0 SUA CAPACIDADE DE ANÁLISE:**

Você pode analisar QUALQUER aspecto das composições:
- **METADADOS:** Títulos, unidades, grupos, classificações
- **CUSTOS:** Valores unitários, totais, comparações entre serviços
- **PRODUTIVIDADE:** HH/unidade, rendimentos, comparações com mercado
- **INSUMOS:** Consumos, materiais, equipamentos, especificações técnicas
- **PREMISSAS:** Escopos, métodos, inclusões/exclusões, riscos
- **ANÁLISES TÉCNICAS:** Recomendações, justificativas, comparativos SINAPI/TCPO
- **PADRÕES E TENDÊNCIAS:** Identificação de similaridades, diferenças, oportunidades

**3.0 ABORDAGEM PARA DIFERENTES TIPOS DE PERGUNTA:**

* **PERGUNTAS ESPECÍFICAS:** Dados precisos de composições específicas
* **PERGUNTAS COMPARATIVAS:** Análise entre múltiplas composições
* **PERGUNTAS EXPLORATÓRIAS:** Listagem e descoberta de composições
* **PERGUNTAS ANALÍTICAS:** Insights, padrões, recomendações baseadas nos dados
* **PERGUNTAS TÉCNICAS:** Detalhes sobre métodos, materiais, execução
`;

    const prompt = `
**4.0 ESTRUTURA DE RESPOSTA - ESCOLHA INTELIGENTE**

Analise a pergunta do usuário e retorne **UM ÚNICO OBJETO JSON** do tipo mais apropriado:

\`\`\`typescript
// Para respostas diretas com dados específicos
type RespostaDireta = {
  tipoResposta: "resposta_direta";
  texto: string; // Resposta rica em informações, com dados concretos
};

// Para listagens e descoberta
type ListaComposicoes = {
  tipoResposta: "lista_composicoes";
  ids: string[]; // IDs das composições relevantes
  textoIntroducao: string; // Contexto e insights sobre a listagem
};

// Para análises profundas e comparativos
type RespostaAnalitica = {
  tipoResposta: "resposta_analitica";
  texto: string; // Análise rica com comparações, padrões, insights
  idsReferenciados: string[]; // Todas as composições usadas na análise
};

// Quando não encontrar informações suficientes
type NaoEncontrado = {
  tipoResposta: "nao_encontrado";
  texto: string; // Explicação clara do que não foi encontrado
};
\`\`\`

**5.0 REGRAS DE ANÁLISE INTELIGENTE**

* **BUSCA ABRANGENTE:** Explore TODAS as seções das composições relevantes
* **CONTEXTUALIZAÇÃO:** Sempre que possível, forneça contexto comparativo
* **DADOS CONCRETOS:** Use valores específicos das composições
* **IDENTIFICAÇÃO DE PADRÕES:** Destaque similaridades, diferenças, tendências
* **ALERTAS RELEVANTES:** Mencione riscos ou considerações importantes quando aplicável

**6.0 DADOS PARA ANÁLISE**

* **PERGUNTA DO USUÁRIO:** "${query}"
* **BASE DE DADOS DE COMPOSIÇÕES:** ${JSON.stringify(compositions)}

**7.0 EXEMPLOS DE RESPOSTAS DE ALTA QUALIDADE**

* Para "quais composições de contrapiso tenho?": Liste TODAS as de contrapiso com breve descrição dos diferenciais
* Para "qual a produtividade média para alvenaria?": Calcule a média, mostre variação, destaque os extremos
* Para "compare os custos de diferentes técnicas": Análise comparativa com vantagens/desvantagens
* Para "quais riscos vejo na composição X?": Identifique premissas críticas e exclusões importantes

**AGORA ANALISE E RESPONDA:**
`;

    try {
        const model = aiInstance.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            systemInstruction: systemInstruction 
        });
        const result = await withRetry(() => model.generateContent(prompt));
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
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        throw new Error(`A IA falhou ao buscar na base de dados de composições: ${errorMessage}`);
    }
};

export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    if (!text || text.trim().length < 50) {
        throw new Error("O texto fornecido é muito curto ou inválido para ser uma composição.");
    }

    const prompt = `
**1.0 PERSONA E OBJETIVOS ESTRATÉGICOS**

Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos.

**2.0 TAREFA PRINCIPAL**

Sua função é receber um texto de entrada (uma ou mais composições) e extrair TODOS os dados estruturados para um objeto JSON, garantindo máxima fidelidade aos valores originais.

**3.0 REGRAS DE PROCESSAMENTO - FIDELIDADE E COMPLETUDE**

* **REGRA DE OURO (JSON VÁLIDO):** Sua resposta DEVE ser um array JSON válido.
* **CAPTURA TOTAL DE DADOS:** Extraia TODAS as colunas das tabelas fornecidas.
* **INDICADORES PRÉ-CALCULADOS:** Se o texto de entrada já contém uma tabela de "Indicadores", use os valores dela prioritariamente.

**4.0 ESTRUTURA DE DADOS ALVO - JSON COMPLETO**

Sua saída deve seguir ESTA estrutura exata:

\`\`\`json
[
  {
    "codigo": "COMP-CIVIL-001",
    "titulo": "Título da Composição",
    "unidade": "m²",
    "quantidadeReferencia": 100.00,
    "grupo": "Grupo Principal",
    "subgrupo": "Subgrupo",
    "tags": ["tag1", "tag2"],
    "classificacaoInterna": "técnica / moderada / médio_risco",
    "premissas": {
      "escopo": "Texto do escopo...",
      "metodo": "Texto do método...",
      "incluso": "Texto do incluso...",
      "naoIncluso": "Texto do não incluso..."
    },
    "insumos": {
      "materiais": [
        {
          "item": "Nome do Material",
          "unidade": "kg",
          "quantidade": 12.5,
          "valorUnitario": 0.85,
          "valorTotal": 10.63,
          "pesoUnitario": 1.0, 
          "pesoTotal": 12.5
        }
      ],
      "equipamentos": [
        {
          "item": "Nome do Equipamento",
          "unidade": "h",
          "quantidade": 0.02,
          "valorUnitario": 15.0,
          "valorTotal": 0.3,
          "pesoUnitario": 0,
          "pesoTotal": 0
        }
      ]
    },
    "maoDeObra": [
      {
        "funcao": "Pedreiro",
        "hhPorUnidade": 0.15,
        "custoUnitario": 25.0,
        "custoTotal": 3.75
      }
    ],
    "quantitativosConsolidados": {
      "listaCompraMateriais": [
        {
          "item": "Nome do Material na Compra",
          "unidadeCompra": "saco 20kg",
          "quantidadeBruta": 13.0,
          "quantidadeAComprar": 1,
          "custoTotalEstimado": 17.0
        }
      ]
    },
    "indicadores": {
      "custoMateriaisPorUnidade": 10.63,
      "custoEquipamentosPorUnidade": 0.3,
      "custoMaoDeObraPorUnidade": 3.75,
      "custoDiretoTotalPorUnidade": 14.68,
      "custoMateriaisTotal": 1063.0,
      "custoEquipamentosTotal": 30.0,
      "custoMaoDeObraTotal": 375.0,
      "custoDiretoTotalTotal": 1468.0,
      "pesoMateriaisPorUnidade": 12.5,
      "pesoMateriaisTotal": 1250.0,
      "volumeEntulhoPorUnidade": 0.05,
      "volumeEntulhoTotal": 5.0,
      "maoDeObraDetalhada": [
         { "funcao": "Pedreiro", "hhPorUnidade": 0.15, "hhTotal": 15.0 }
      ]
    },
    "guias": {
      "dicasExecucao": "Texto...",
      "alertasSeguranca": "Texto...",
      "criteriosQualidade": "Texto..."
    },
    "analiseEngenheiro": {
      "nota": "Texto...",
      "fontesReferencias": "Texto...",
      "quadroProdutividade": "Texto...",
      "analiseRecomendacao": "Texto...",
      "notaDaImportacao": "Sucesso."
    }
  }
]
\`\`\`

**6.0 FORMATO DE SAÍDA**

Retorne APENAS o array JSON válido.
`;

    const fullPrompt = `${prompt}\n\n---\nTexto para Análise:\n---\n${text}`;

    try {
        const aiInstance = getAiInstance();
        if (!aiInstance) throw new Error("IA não configurada.");

        const model = aiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Usa o sistema de retry para lidar com erros temporários
        const result = await withRetry(() => model.generateContent(fullPrompt), {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2
        });
        
        const response = result.response;
        const responseText = response.text();

        if (!responseText) {
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }

        console.log("Resposta bruta da IA:", responseText);

        let textToParse = extractAndCleanJson(responseText);

        console.log("Texto limpo para parse:", textToParse);

        // VALIDAÇÃO E CORREÇÃO ROBUSTA DO JSON
        let parsedData;
        let parseAttempts = 0;
        const maxParseAttempts = 3;

        while (parseAttempts < maxParseAttempts) {
            try {
                parsedData = JSON.parse(textToParse);
                break; // Se deu certo, sai do loop
            } catch (parseError) {
                parseAttempts++;
                console.warn(`Tentativa ${parseAttempts} de parse falhou:`, parseError);
                
                if (parseAttempts === maxParseAttempts) {
                    console.error("Todas as tentativas de parse falharam:", parseError);
                    const errorMessage = parseError instanceof Error ? parseError.message : 'Erro desconhecido';
                    throw new Error(`Não foi possível interpretar o JSON retornado pela IA após ${maxParseAttempts} tentativas. Erro: ${errorMessage}`);
                }

                // Tenta corrigir problemas comuns de JSON
                textToParse = textToParse
                    .replace(/(\w+):/g, '"$1":') // Adiciona aspas em chaves não citadas
                    .replace(/,(\s*[}\]])/g, '$1') // Remove vírgulas trailing
                    .replace(/,\s*}/g, '}') // Remove vírgulas antes de fechar chaves
                    .replace(/,\s*]/g, ']') // Remove vírgulas antes de fechar colchetes
                    .replace(/'/g, '"') // Substitui aspas simples por duplas
                    .replace(/\\n/g, ' ') // Remove quebras de linha problemáticas
                    .replace(/\s+/g, ' ') // Normaliza espaços
                    .trim();

                console.log(`Texto corrigido na tentativa ${parseAttempts}:`, textToParse);
            }
        }

        // Validação da estrutura
        if (Array.isArray(parsedData)) {
            const validCompositions = parsedData.filter((comp: any) => 
                comp && typeof comp === 'object' && comp.titulo
            );
            
            if (validCompositions.length === 0) {
                throw new Error("A IA retornou um array vazio ou sem composições válidas.");
            }
            
            console.log(`✅ ${validCompositions.length} composição(ões) válida(s) extraída(s)`);
            return validCompositions as ParsedComposicao[];
        }
        
        if (typeof parsedData === 'object' && parsedData !== null && parsedData.titulo) {
            console.log("✅ 1 composição válida extraída");
            return [parsedData as ParsedComposicao];
        }
        
        throw new Error("A IA não retornou um array ou objeto de composições válido.");

    } catch (error) {
        console.error("Erro ao processar composições:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        throw new Error(`Não foi possível interpretar o texto da composição: ${errorMessage}`);
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
        Retorne APENAS o objeto JSON corrigido. Não adicione nenhum texto, explicação ou formatação adicional antes ou depois do objeto JSON. Sua resposta deve ser diretamente parseável por JSON.parse().
    `;

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await withRetry(() => model.generateContent(prompt));
        const response = result.response;
        let textToParse = response.text();

        if (typeof textToParse !== 'string') {
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }
        
        textToParse = extractAndCleanJson(textToParse);

        const parsedData: ParsedComposicao = JSON.parse(textToParse);
        
        if (!parsedData.titulo) {
             throw new Error("A IA retornou um objeto de composição inválido.");
        }

        return parsedData;

    } catch (error) {
        console.error("Erro ao revisar composição:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        throw new Error(`Não foi possível aplicar a correção na composição: ${errorMessage}`);
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
* **Precisão do Engenheiro:** Você entende o contexto de uma obra. Sua análise vai além do texto e considera a aplicabilidade prática. Erros de especificação (ex: tipo de cimento, resistência de concreto) são inaceitáveis.
* **Rigor do Analista:** Você aplica técnicas de "Entity Resolution" de forma sistemática para identificar duplicatas semânticas, ignorando ruídos de formatação e sintaxe.
* **Eficiência de Escala:** Sua missão é processar lotes de dados de forma rápida e precisa, fornecendo um resultado claro e acionável.
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
* **Pré-Filtro de Categoria:** Primeiro, identifique a categoria principal do serviço (ex: Contrapiso, Alvenaria, Demolição). Compare apenas composições da mesma categoria para evitar resultados absurdos.
* **Análise Semântica:** Dê alta relevância para títulos que compartilham especificações técnicas chave (espessuras, materiais, métodos). A ordem das palavras não importa.
* **Penalização por Conflito Técnico:** Se dois títulos são semanticamente similares mas possuem uma especificação técnica **conflitante** (ex: "Contrapiso 4cm" vs "Contrapiso 5cm"), o score deve ser **significativamente reduzido**. Eles são relacionados, mas não são substitutos diretos.
* **Score:** Atribua um \`relevanciaScore\` de 0 a 100.
* **Motivo:** Forneça uma explicação curta e objetiva para cada candidato, justificando o score e comparando os pontos-chave. Ex: "Mesmo serviço (sóculo), mas material diferente (Bloco de Concreto vs. Bloco Cerâmico) e altura conflitante (15cm vs 19cm)."

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
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await withRetry(() => model.generateContent(fullPrompt));
        const response = result.response;
        const textToParse = response.text();

        if (typeof textToParse !== 'string') {
            throw new Error("A IA retornou uma resposta inválida ou vazia.");
        }

        const cleanedText = extractAndCleanJson(textToParse);
        const parsedData = JSON.parse(cleanedText);

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

// ====================================================================================================
// NOVA FUNÇÃO: CLASSIFICAÇÃO AUTOMÁTICA (Grupo, Subgrupo e Código)
// ====================================================================================================

export const classifyComposition = async (titulo: string, codigosExistentes: string[] = []): Promise<ClassificationResult> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não está configurado.");

    const prompt = `
    **PERSONA:** Engenheiro de Custos Sênior especialista em taxonomias SINAPI e TCPO.

    **TAREFA:**
    Analise o título da composição de construção civil abaixo e classifique-a tecnicamente.
    **NÃO COPIE** simplesmente o nome. Use seu conhecimento de engenharia para deduzir a família correta do serviço.

    **ENTRADA:** "${titulo}"

    **OBJETIVOS:**
    1. **Grupo:** A categoria macro (ex: Identifique se é "Revestimentos", "Estrutura", "Instalações", "Pisos", "Alvenaria" etc).
    2. **Subgrupo:** A especificação técnica refinada (ex: Se for Piso, é "Cerâmico"? "Porcelanato"? "Cimentício"?).
    3. **Sugestão de Código:** Crie um código curto e mnemônico.
       - Lógica: 3 letras do grupo + 3 letras do subgrupo + numeração (ex: REV.PIS.001).
       - Analise os códigos existentes (${JSON.stringify(codigosExistentes)}) e sugira o PRÓXIMO da sequência lógica se possível.
    4. **Justificativa:** Breve explicação técnica do porquê dessa classificação.

    **FORMATO DE SAÍDA (JSON PURO):**
    Responda APENAS com este objeto JSON:
    {
      "grupo": "String",
      "subgrupo": "String",
      "sugestaoCodigo": "String",
      "justificativa": "String"
    }
    `;

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        // Usamos o retry para garantir que ele tente de novo se a API falhar rapidinho
        const result = await withRetry(() => model.generateContent(prompt));
        const response = result.response;
        let text = response.text();

        if (typeof text === 'string') {
            // Limpeza para garantir que venha só o JSON
            const cleanedText = extractAndCleanJson(text);
            return JSON.parse(cleanedText) as ClassificationResult;
        } else {
            throw new Error("Resposta inválida da IA.");
        }
    } catch (error) {
        console.error("Erro ao classificar composição:", error);
        // Retorno de fallback para não travar sua tela se a IA falhar
        return {
            grupo: "Geral",
            subgrupo: "Sem classificação",
            sugestaoCodigo: "GEN.000",
            justificativa: "Não foi possível classificar automaticamente."
        };
    }
};
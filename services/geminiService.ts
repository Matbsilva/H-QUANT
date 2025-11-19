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

function getAiInstance() {
    if (ai) {
        return ai;
    }
    // Tenta pegar do Vite (import.meta)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (apiKey) {
        ai = new GoogleGenerativeAI(apiKey);
        return ai;
    }
    console.warn("Gemini AI service is not initialized. Check VITE_GEMINI_API_KEY in .env file.");
    return null;
}

// Sistema de Retry para estabilidade
async function withRetry<T>(operation: () => Promise<T>, options: { maxRetries?: number, initialDelay?: number } = {}): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000 } = options;
    let lastError: Error;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt)));
        }
    }
    throw lastError!;
}

function extractAndCleanJson(text: string): string {
    let textToParse = text.replace(/```json|```/g, '').trim();
    textToParse = textToParse.replace(/[\u0000-\u0019]+/g,"");
    return textToParse;
}

// ====================================================================================================
// 1. FUNÇÃO DE IMPORTAÇÃO (ENGENHEIRO TAXONOMISTA & DETALHISTA)
// ====================================================================================================

export const parseCompositions = async (text: string): Promise<ParsedComposicao[]> => {
    if (!text || text.trim().length < 20) {
        throw new Error("Texto muito curto ou inválido. Cole o conteúdo completo da composição.");
    }

    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("IA não configurada. Verifique a API Key.");

    const prompt = `
**1.0 PERSONA: ENGENHEIRO DE CUSTOS SÊNIOR & GESTOR DE TAXONOMIA**
Você é o guardião do banco de dados da "Quantisa". Sua missão é ler composições completas e estruturá-las com fidelidade absoluta.

**2.0 MISSÃO DE CLASSIFICAÇÃO (TAXONOMIA INTELIGENTE)**
Analise o CONTEÚDO TÉCNICO para corrigir Grupos e Códigos errados.
* **GRUPOS PADRÃO:** ESTRUTURA E VEDAÇÕES, PISOS E REVESTIMENTOS, ACABAMENTOS E PINTURA, IMPERMEABILIZAÇÃO, INSTALAÇÕES PREDIAIS, COBERTURA.
* **CÓDIGO:** Se o original for bom (ex: COMP-CIVIL-PISO-02), mantenha. Se não, gere: \`COMP-[GRUPO]-[SUB]-[NUM]\`.

**3.0 EXTRAÇÃO DE DADOS (LEITURA COMPLETA)**
Você deve preencher TODOS os campos do JSON baseando-se nas seções do texto:

* **SEÇÃO 1 (PREMISSAS):** Extraia Escopo, Método, Incluso e Não Incluso.
* **SEÇÃO 2 (INSUMOS):** Extraia a lista detalhada de Materiais e Equipamentos. 
    * **ATENÇÃO:** Capture também as colunas de "Peso Unitário" e "Peso Total" se existirem.
* **SEÇÃO 3 (MÃO DE OBRA):** Extraia Função, HH/Unidade, Custo Unitário e Total.
* **SEÇÃO 4 (CONSOLIDADOS):** Extraia a "Lista de Compra de Materiais" (Item, Unidade Compra, Qtd A Comprar).
* **SEÇÃO 5 (INDICADORES):** Copie os valores EXATOS da tabela de indicadores (Custos, Pesos Totais, Volume de Entulho, HH Total).
* **SEÇÃO 6 (GUIAS):** Dicas, Segurança e Qualidade.
* **SEÇÃO 7 (ANÁLISE):** Nota, Fontes e Recomendações.

**4.0 SAÍDA OBRIGATÓRIA (JSON ARRAY)**
Retorne APENAS o JSON abaixo, sem markdown extra.

\`\`\`json
[
  {
    "codigo": "...",
    "titulo": "...",
    "unidade": "...",
    "quantidadeReferencia": 1.0,
    "grupo": "...",
    "subgrupo": "...",
    "tags": ["tag1", "tag2"],
    "classificacaoInterna": "...",
    "premissas": { 
        "escopo": "...", 
        "metodo": "...", 
        "incluso": "...", 
        "naoIncluso": "..." 
    },
    "insumos": {
      "materiais": [
          { "item": "...", "unidade": "...", "quantidade": 0, "valorUnitario": 0, "valorTotal": 0, "pesoUnitario": 0, "pesoTotal": 0 }
      ],
      "equipamentos": [
          { "item": "...", "unidade": "...", "quantidade": 0, "valorUnitario": 0, "valorTotal": 0, "pesoUnitario": 0, "pesoTotal": 0 }
      ]
    },
    "maoDeObra": [
        { "funcao": "...", "hhPorUnidade": 0, "custoUnitario": 0, "custoTotal": 0 }
    ],
    "quantitativosConsolidados": {
       "listaCompraMateriais": [
           { "item": "...", "unidadeCompra": "...", "quantidadeBruta": 0, "quantidadeAComprar": 0, "custoTotalEstimado": 0 }
       ]
    },
    "indicadores": {
      "custoMateriaisPorUnidade": 0, 
      "custoMateriaisTotal": 0,
      "custoEquipamentosPorUnidade": 0, 
      "custoEquipamentosTotal": 0,
      "custoMaoDeObraPorUnidade": 0, 
      "custoMaoDeObraTotal": 0,
      "custoDiretoTotalPorUnidade": 0, 
      "custoDiretoTotalTotal": 0,
      "pesoMateriaisPorUnidade": 0, 
      "pesoMateriaisTotal": 0,
      "volumeEntulhoPorUnidade": 0, 
      "volumeEntulhoTotal": 0,
      "maoDeObraDetalhada": [
          { "funcao": "...", "hhPorUnidade": 0, "hhTotal": 0 }
      ]
    },
    "guias": { 
        "dicasExecucao": "...", 
        "alertasSeguranca": "...", 
        "criteriosQualidade": "..." 
    },
    "analiseEngenheiro": {
      "nota": "...",
      "fontesReferencias": "...",
      "quadroProdutividade": "...",
      "analiseRecomendacao": "...",
      "notaDaImportacao": "Explique aqui sua decisão sobre Grupo e Código."
    }
  }
]
\`\`\`
`;

    const fullPrompt = `${prompt}\n\n---\nTEXTO PARA ANÁLISE:\n${text}`;

    try {
        const model = aiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await withRetry(() => model.generateContent(fullPrompt));
        const textResponse = result.response.text();
        const jsonString = extractAndCleanJson(textResponse);
        
        const parsedData = JSON.parse(jsonString);
        return Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch (error) {
        console.error("Erro no parse:", error);
        throw new Error("Falha ao interpretar composição. Verifique se o texto está completo.");
    }
};

// ====================================================================================================
// 2. FUNÇÃO DE CHAT (ASK H-QUANT)
// ====================================================================================================

export const answerQueryFromCompositions = async (query: string, compositions: Composicao[]): Promise<GeminiResponse> => {
     const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não configurado.");

    const contextData = compositions.map(c => ({
        id: c.id,
        codigo: c.codigo,
        titulo: c.titulo,
        unidade: c.unidade,
        grupo: c.grupo,
        custoTotal: c.indicadores?.custoDiretoTotalPorUnidade,
        custoMat: c.indicadores?.custoMateriaisPorUnidade,
        custoMO: c.indicadores?.custoMaoDeObraPorUnidade,
        escopo: c.premissas?.escopo
    }));

    const prompt = `
    **PERSONA:** "Ask H-Quant", consultor sênior de engenharia de custos.
    **FONTE DE DADOS:** Você tem acesso APENAS ao seguinte banco de dados local:
    ${JSON.stringify(contextData)}

    **PERGUNTA DO USUÁRIO:** "${query}"

    **REGRAS:**
    1. **MOSTRE CARDS:** Se a pergunta for sobre preço, lista ou tipos, use \`lista_composicoes\`.
    2. **SEJA ESPECÍFICO:** Se perguntarem preço, cite o código e o valor exato.

    **FORMATO JSON OBRIGATÓRIO (Escolha UM):**

    [CASO 1: Lista/Cards]
    { "tipoResposta": "lista_composicoes", "ids": ["id_1", "id_2"], "textoIntroducao": "Encontrei estas opções:" }

    [CASO 2: Texto Direto]
    { "tipoResposta": "resposta_direta", "texto": "..." }

    [CASO 3: Análise]
    { "tipoResposta": "resposta_analitica", "texto": "...", "idsReferenciados": ["id_A"] }

    [CASO 4: Não Encontrado]
    { "tipoResposta": "nao_encontrado", "texto": "..." }
    `;

    try {
        const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await withRetry(() => model.generateContent(prompt));
        const text = result.response.text();
        return JSON.parse(extractAndCleanJson(text));
    } catch (error) {
        console.error("Erro no Ask H-Quant:", error);
        return {
            tipoResposta: "resposta_direta",
            texto: "Desculpe, não consegui processar sua pergunta com a base de dados atual."
        };
    }
};

// ====================================================================================================
// 3. FUNÇÕES AUXILIARES
// ====================================================================================================

export const reviseParsedComposition = async (composition: ParsedComposicao, instruction: string): Promise<ParsedComposicao> => {
    const aiInstance = getAiInstance();
    if (!aiInstance) throw new Error("Serviço de IA não configurado.");

    const prompt = `
        **PERSONA:** Assistente de correção de dados.
        **CONTEXTO:** JSON incorreto: ${JSON.stringify(composition)}
        **INSTRUÇÃO:** "${instruction}"
        Retorne APENAS o JSON corrigido.
    `;

    const model = aiInstance.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await withRetry(() => model.generateContent(prompt));
    return JSON.parse(extractAndCleanJson(result.response.text()));
}

export const findRelevantCompositionsInBatch = async (newCompositions: any[], existingCompositions: any[]): Promise<any[]> => {
    return newCompositions.map(c => ({ idNovaComposicao: c.id, candidatos: [] }));
}

// --- ESTA FUNÇÃO É ESSENCIAL PARA O BOTÃO DE COPIAR ---
export const exportCompositionToMarkdown = (composition: Composicao): string => {
     let markdown = ``;
    const createTable = (headers: string[], rows: (string|number)[][]) => {
        if (!rows || rows.length === 0) return 'N/A\n';
        let table = `| ${headers.join(' | ')} |\n`;
        table += `|${headers.map(() => ' :--- ').join('|')}|\n`;
        rows.forEach(row => { table += `| ${row.join(' | ')} |\n`; });
        return table;
    };
    
    markdown += `# ${composition.codigo} - ${composition.titulo}\n\n`;
    markdown += `**Unidade:** ${composition.unidade || ''}\n`;
    markdown += `**Grupo:** ${composition.grupo || ''} / ${composition.subgrupo || ''}\n\n`;
    
    markdown += `### Resumo Financeiro (por ${composition.unidade})\n`;
    markdown += `- **Material:** R$ ${composition.indicadores?.custoMateriaisPorUnidade?.toFixed(2)}\n`;
    markdown += `- **Mão de Obra:** R$ ${composition.indicadores?.custoMaoDeObraPorUnidade?.toFixed(2)}\n`;
    markdown += `- **Equipamentos:** R$ ${composition.indicadores?.custoEquipamentosPorUnidade?.toFixed(2)}\n`;
    markdown += `- **TOTAL:** R$ ${composition.indicadores?.custoDiretoTotalPorUnidade?.toFixed(2)}\n\n`;

    markdown += `### Premissas\n`;
    markdown += `> ${composition.premissas?.escopo}\n\n`;

    markdown += `### Insumos Principais\n`;
    const matRows = composition.insumos?.materiais?.map(i => [i.item, i.unidade, i.quantidade, `R$ ${i.valorUnitario}`, `R$ ${i.valorTotal}`]) || [];
    markdown += createTable(['Item', 'Un', 'Qtd', 'Valor Unit.', 'Total'], matRows);

    return markdown;
};
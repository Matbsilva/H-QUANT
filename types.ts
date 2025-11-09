

export enum Priority {
    High = 'Alta',
    Medium = 'Média',
    Low = 'Baixa',
}

export enum KanbanStatus {
    Backlog = 'Backlog / Caixa de Entrada',
    InProgress = 'Em Orçamentação',
    ReadyToSend = 'Pronto para Envio',
    Sent = 'Enviado (Recente)',
    Waiting = 'Aguardando Retorno',
    Approved = 'Aprovado',
    Declined = 'Declinado',
    Archived = 'Arquivo Morto',
}

export interface ReturnHistoryItem {
    id: string;
    date: string;
    notes: string;
}

export interface Doubt {
    id: string;
    question: string;
    options?: string[]; // Para sugestões de múltipla escolha
}

export interface Service {
    id: string;
    nome: string;
    description?: string; // Adicionado para o escopo detalhado
    quantidade: number;
    unidade: string;
}

export interface ParsedAnalysis {
    projectName?: string;
    clientName?: string;
    deadline?: string;
    priority?: Priority;
    briefingSummary?: string;
    services?: Service[];
    doubts?: Doubt[];
    keyMaterials?: string[];
    valueEngineering?: string[];
    preliminaryRisks?: string[];
    rawAnalysisText?: string; // Mantém o texto bruto para referência, se necessário
}

export interface RefinementSuggestion {
    doubtId: string;
    question: string;
    suggestedAnswers: {
        answer: string;
        tag: string;
        actionType: 'modify' | 'add';
    }[];
}

export interface ValueEngineeringOption {
    solution: string;
    relativeCost: string;
    deadlineImpact: string;
    pros: string[];
    cons: string[];
    recommendation: string;
}

export interface ValueEngineeringAnalysis {
    itemId: string;
    itemName: string;
    options: ValueEngineeringOption[];
}

export interface InternalQuery {
    id: string;
    query: string;
}


export type ApprovalStatus = 'approved' | 'rejected' | null;

export interface InternalQueryApproval {
    status: ApprovalStatus;
    comment: string;
}


export interface Project {
    id: string;
    nome: string;
    cliente: string;
    data_entrada: string;
    data_limite: string;
    prioridade: Priority;
    status: KanbanStatus;
    resumo_tecnico: string;
    briefing?: string;
    data_envio?: Date;
    returns?: ReturnHistoryItem[];
    initialAnalysis?: string;
    services?: Service[];
    doubts?: Doubt[];
    keyMaterials?: string[];
    valueEngineering?: string[];
    preliminaryRisks?: string[];
    clientAnswers?: string; // Respostas do cliente para as dúvidas
    detailedServices?: Service[]; // Para a etapa "Escopo Detalhado"
    pendingDoubts?: Doubt[]; // Dúvidas que não foram respondidas
    internalQueries?: InternalQuery[]; // This will now use the updated InternalQuery type.
    observations?: string[]; // ADDED: For general project notes that don't fit into a specific service.
    internalQueryApprovals?: Record<string, InternalQueryApproval>; // Para armazenar as respostas do usuário
    compositionMappings?: Record<string, { type: 'existing' | 'new', selectedCompositionId?: string }>;
    refinementSuggestions?: RefinementSuggestion[]; // Sugestões da IA para dúvidas pendentes
    valueEngineeringAnalysis?: ValueEngineeringAnalysis[]; // Análise de EV da IA
    refinementSelections?: Record<string, string>; // { doubtId: selectedOption | '__OTHER__' }
    customRefinementAnswers?: Record<string, string>; // { doubtId: 'custom text answer' }
    valueEngineeringSelections?: Record<string, string>; // { itemId: selectedAlternativeSolution }
}


export interface PriceHistory {
  date: string;
  cost: number;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  custo: number; // Represents the LATEST cost for display purposes
  tipo: 'Material' | 'MaoObra' | 'Equipamento';
  marca?: string;
  observacao?: string;
  priceHistory: PriceHistory[];
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  thinking?: boolean;
}

export interface GroundingChunk {
  web?: {
    // FIX: Made uri and title optional to match the type from @google/genai SDK.
    uri?: string;
    title?: string;
  };
}

export interface GroundingMetadata {
  // FIX: Made groundingChunks optional to match the type from @google/genai SDK.
  groundingChunks?: GroundingChunk[];
}

export interface SearchResult {
  text: string;
  metadata?: GroundingMetadata;
}

// --- NEW COMPOSITION TYPES (V1.2 FINAL) ---

export interface ComposicaoInsumo {
  item: string;
  unidade: string;
  quantidade: number; // Formerly quantidadeComPerda
  valorUnitario: number;
  valorTotal: number;
  pesoUnitario?: number; 
  pesoTotal?: number;
}

export interface ComposicaoMaoDeObra {
  funcao: string;
  hhPorUnidade: number; // Coeficiente de produtividade
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
    funcao: string; // Ex: "HH Profissional (Pedreiro)"
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
  
  maoDeObraDetalhada: ComposicaoIndicadorMaoDeObra[]; // Array para flexibilidade
  
  pesoMateriais_porUnidade: number;
  pesoMateriais_total: number;
  
  volumeEntulho_porUnidade: number;
  volumeEntulho_total: number;
}

export interface Composicao {
  id: string;
  codigo: string;
  titulo: string;
  unidade: string;
  quantidadeReferencia: number;
  grupo: string;
  subgrupo: string;
  tags: string[];
  classificacaoInterna: string;
  
  premissas: {
    escopo: string;
    metodo: string;
    incluso: string;
    naoIncluso: string;
  };
  
  insumos: {
    materiais: ComposicaoInsumo[];
    equipamentos: ComposicaoInsumo[];
  };
  
  maoDeObra: ComposicaoMaoDeObra[];
  
  quantitativosConsolidados: {
      listaCompraMateriais: ComposicaoListaCompraItem[];
      necessidadeEquipamentos: any[]; // Simplificado, pode ser refinado
      quadroMaoDeObraTotal: any[]; // Simplificado, pode ser refinado
  };

  indicadores: ComposicaoIndicadores;
  
  guias: {
    dicasExecucao: string;
    alertasSeguranca: string;
    criteriosQualidade: string;
  };

  analiseEngenheiro: {
    nota: string;
    fontesReferencias: string;
    quadroProdutividade: string;
    analiseRecomendacao: string;
    notaDaImportacao?: string; // Campo opcional para a nota de adaptação
  };
}
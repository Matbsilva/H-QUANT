


import { Composicao } from '../types';

const createMockComposicao = (
  id: string,
  codigo: string,
  titulo: string,
  unidade: string,
  grupo: string,
  subgrupo: string
): Composicao => {
  // basic numbers for indicators
  const custoMat = Math.random() * 100 + 20;
  const custoMo = Math.random() * 50 + 15;
  const custoEq = Math.random() * 10 + 5;
  const custoTotalUn = custoMat + custoMo + custoEq;
  const qtdRef = Math.floor(Math.random() * 50) + 10;

  return {
    id,
    codigo,
    titulo,
    unidade,
    quantidadeReferencia: qtdRef,
    grupo,
    subgrupo,
    tags: [grupo, subgrupo],
    classificacaoInterna: 'Padrão',
    premissas: {
      escopo: `Execução de ${titulo.toLowerCase()} conforme especificações.`,
      metodo: 'Método executivo padrão de mercado.',
      incluso: 'Fornecimento de materiais, mão de obra e equipamentos necessários.',
      naoIncluso: 'Licenças, taxas e remoção de entulho fora da área de trabalho.',
    },
    insumos: {
      materiais: [
        { item: 'Insumo Material Genérico 1', unidade: 'un', quantidade: 1.05, valorUnitario: custoMat * 0.6, valorTotal: custoMat * 0.6 * 1.05 },
        { item: 'Insumo Material Genérico 2', unidade: 'kg', quantidade: 0.5, valorUnitario: custoMat * 0.4, valorTotal: custoMat * 0.4 * 0.5 },
      ],
      equipamentos: [
        { item: 'Equipamento Leve (consumo)', unidade: 'h', quantidade: 0.1, valorUnitario: custoEq * 10, valorTotal: custoEq },
      ],
    },
    maoDeObra: [
      { funcao: 'Profissional', hhPorUnidade: 0.8, custoUnitario: custoMo / 0.8, custoTotal: custoMo },
    ],
    quantitativosConsolidados: {
      listaCompraMateriais: [],
      necessidadeEquipamentos: [],
      quadroMaoDeObraTotal: [],
    },
    indicadores: {
      custoMateriais_porUnidade: custoMat,
      custoEquipamentos_porUnidade: custoEq,
      custoMaoDeObra_porUnidade: custoMo,
      custoDiretoTotal_porUnidade: custoTotalUn,
      custoMateriais_total: custoMat * qtdRef,
      custoEquipamentos_total: custoEq * qtdRef,
      custoMaoDeObra_total: custoMo * qtdRef,
      custoDiretoTotal_total: custoTotalUn * qtdRef,
      maoDeObraDetalhada: [{ funcao: 'Profissional', hhPorUnidade: 0.8, hhTotal: 0.8 * qtdRef }],
      pesoMateriais_porUnidade: Math.random() * 10,
      pesoMateriais_total: Math.random() * 10 * qtdRef,
      volumeEntulho_porUnidade: Math.random() * 0.01,
      volumeEntulho_total: Math.random() * 0.01 * qtdRef,
    },
    guias: {
      dicasExecucao: 'Seguir as boas práticas de execução para este tipo de serviço.',
      alertasSeguranca: 'Utilizar todos os EPIs necessários, como capacete, luvas e óculos de proteção.',
      criteriosQualidade: 'Verificar o alinhamento, prumo e nível conforme projeto.',
    },
    analiseEngenheiro: {
      nota: 'Composição de custo padrão, baseada em produtividade média de mercado.',
      fontesReferencias: `**Coeficientes de Consumo:** Baseado em consumo de mercado.\n\n**Coeficientes de Produtividade:** Índice de 0.80 HH/${unidade}, considerado padrão.`,
      quadroProdutividade: `| Fonte de Referência | Produtividade (HH/${unidade}) | Custo M.O. (R$/${unidade}) | Variação vs. Adotado |\n| :--- | :--- | :--- | :--- |\n| **Índice Adotado (Total)** | **0.80** | **R$ ${custoMo.toFixed(2).replace('.',',')}** | **-** |\n| Fonte de Mercado (Ex.) | 0.75 | R$ ${(custoMo / 0.8 * 0.75).toFixed(2).replace('.',',')} | -6.25% |`,
      analiseRecomendacao: 'Recomendado para orçamentos preliminares. Ajustar produtividade conforme complexidade da obra.',
    },
  };
};

const mockComposicoesList: Composicao[] = [
    // 1. ACABAMENTOS E LOGÍSTICA
    createMockComposicao('comp-1', 'ACAB-REG-01', 'Execução de Regularização de Parede com Argamassa (e=3cm)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-2', 'ACAB-LOG-01', 'Montagem e Desmontagem de Torre de Andaime Tubular', 'un', 'ACABAMENTOS', 'LOGISTICA'),
    createMockComposicao('comp-3', 'ACAB-INST-01', 'Instalação de Rodapé de Poliestireno', 'ml', 'ACABAMENTOS', 'INSTALACAO'),
    createMockComposicao('comp-4', 'ACAB-REG-02', 'Regularização de Parede com Argamassa Colante ACIII (e=1cm)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-5', 'ACAB-PREP-01', 'Chapisco em Superfícies de Alvenaria (3mm de espessura)', 'm²', 'ACABAMENTOS', 'PREPARACAO'),
    createMockComposicao('comp-6', 'ACAB-PREP-02', 'Execução de chapisco armado em rodapés para base de impermeabilização', 'ml', 'ACABAMENTOS', 'PREPARACAO'),
    createMockComposicao('comp-7', 'ACAB-PINT-01', 'Pintura Epóxi sobre Drywall em Sala Limpa (Fundo e Acabamento)', 'm²', 'ACABAMENTOS', 'PINTURA'),
    createMockComposicao('comp-8', 'ACAB-REG-03', 'Regularização de Parede - 2cm (Chapisco + Reboco)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-9', 'ACAB-REG-04', 'Regularização de Parede - 3cm (Chapisco + Reboco)', 'm²', 'ACABAMENTOS', 'REGULARIZACAO'),
    createMockComposicao('comp-10', 'ACAB-ACAB-01', 'Requadro de Vãos (Portas/Janelas)', 'ml', 'ACABAMENTOS', 'ACABAMENTO'),

    // 2. ACESSÓRIOS E COMUNICAÇÃO VISUAL
    createMockComposicao('comp-11', 'ACESS-PEL-01', 'Aplicação de Película de Vidro Leitosa (Jateada)', 'm²', 'ACESSORIOS', 'PELICULA'),
    createMockComposicao('comp-12', 'ACESS-DISP-01', 'Fornecimento e Instalação de Dispenser de Acrílico para Paramentação', 'un', 'ACESSORIOS', 'DISPENSER'),

    // 3. ALVENARIA E VEDAÇÕES
    createMockComposicao('comp-13', 'ALV-MUR-01', 'Execução de Septo (Mureta H=15cm) em Bloco de Concreto com Regularização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-14', 'ALV-SOC-01', 'Execução de Bacia de Contenção (Sóculo) com Alvenaria, Regularização e Impermeabilização', 'un', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-15', 'ALV-VED-01', 'Instalação de Sistema de Vedação Corta-Fogo (Fire Stop) TRRF 2h', 'ml', 'ALVENARIA', 'VEDACAO'),
    createMockComposicao('comp-16', 'ALV-MUR-02', 'Execução de Mureta em Bloco de Concreto (h=15cm) com Chapisco e Reboco', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-17', 'ALV-SOC-02', 'Execução de Sóculo em Bloco de Concreto (h=15cm) com Regularização Total', 'ml', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-18', 'ALV-PAR-01', 'Alvenaria de Vedação em Bloco de Concreto (inclui argamassa de assentamento e reboco)', 'm²', 'ALVENARIA', 'PAREDE'),
    createMockComposicao('comp-19', 'ALV-BASE-01', 'Base de Concreto Estrutural para Maquinário (FCK 40 MPa), Armada e Ancorada', 'm³', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-20', 'ALV-BASE-02', 'Base de Concreto Estrutural sobre Laje - 4,50m x 4,50m x 0,10m (para até 10 Toneladas)', 'un', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-21', 'ALV-BASE-03', 'Base de Concreto Estrutural sobre Laje - 4,50m x 4,50m x 0,20m (para até 40 Toneladas)', 'un', 'ALVENARIA', 'BASE'),
    createMockComposicao('comp-22', 'ALV-MUR-03', 'Execução de Mureta de Bloco de Concreto (H=15cm) com Regularização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-23', 'ALV-DRY-01', 'Execução de Parede em Drywall (Placa RU + Lã de Rocha)', 'm²', 'ALVENARIA', 'DRYWALL'),
    createMockComposicao('comp-24', 'ALV-MUR-04', 'Mureta de Bloco de Concreto - 1 Fiada (10cm ou 20cm de altura) - Assentamento SEM CAL', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-25', 'ALV-MUR-05', 'Mureta de Bloco de Concreto Celular (H=10cm) - Assentamento', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-26', 'ALV-MUR-06', 'Mureta de Bloco de Concreto Celular (H=10cm) com Regularização e Impermeabilização', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-27', 'ALV-MUR-07', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 10cm de altura COM REGULARIZAÇÃO', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-28', 'ALV-MUR-08', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 30cm de altura (1 Fiada - Bloco Deitado)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-29', 'ALV-MUR-09', 'Mureta de Bloco de Concreto Celular (60x30x10cm) - 30cm de altura COM REGULARIZAÇÃO', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-30', 'ALV-MUR-10', 'Mureta de Bloco de Concreto H=20cm c/ Regularização (1 fiada Bloco 19x19x39cm)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-31', 'ALV-MUR-11', 'Mureta Dupla de Alvenaria H=1,20m - 2x Bloco Concreto 19cm (Rebocada Faces Ext. e Topos)', 'ml', 'ALVENARIA', 'MURETA'),
    createMockComposicao('comp-32', 'ALV-SOC-03', 'Sóculo em U (3x2m) com Regularização e Contrapiso', 'un', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-33', 'ALV-SOC-04', 'Sóculo em bloco cerâmico (altura 19 cm)', 'ml', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-34', 'ALV-SOC-05', 'Sóculo em bloco cerâmico (altura 19 cm) - por m² de face', 'm²', 'ALVENARIA', 'SOCULO'),
    createMockComposicao('comp-35', 'ALV-SOC-06', 'Sóculo de Contenção até 2,90m² em Formato de U (Muretas H=15cm + Contrapiso 2cm)', 'un', 'ALVENARIA', 'SOCULO'),
];


export const mockComposicoes: Composicao[] = [...mockComposicoesList];
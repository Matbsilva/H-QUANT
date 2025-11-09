"use client";

import React, { useState, useEffect } from 'react';
import { Button, Spinner, XIcon } from './Shared';
import { analyzeText, analyzeImage } from '../services/geminiService';
import type { ParsedAnalysis } from '../types';

export const AnalysisView: React.FC<{ onAdvance: (analysisData: ParsedAnalysis) => void; }> = ({ onAdvance }) => {
    const [textScope, setTextScope] = useState('Escopo Preliminar – Reforma Comercial 11º Andar PROJETO: Reforma Comercial 11º Andar\n\n1. Demolição de paredes de drywall existentes conforme projeto (estimativa de 45 m²).\n2. Construção de novas paredes de drywall com isolamento acústico (estimativa de 60 m²).\n3. Execução de contrapiso para nivelamento de área de 150 m², espessura média de 5 cm.\n4. Instalação de piso vinílico em réguas sobre o novo contrapiso (150 m²).\n5. Regularização de paredes para pintura (massa corrida) - área de 150 m².\n6. Execução de forro de gesso, incluindo tabica e cortineiros (95 m²).\n7. Pintura de paredes com tinta acrílica fosca, duas demãos (150 m²).');
    const command = `1.0 PERSONA E OBJETIVOS ESTRATÉGICOS (OBRIGATÓRIO INTERNALIZAR)
Você atuará como um Engenheiro Civil Sênior e especialista em orçamentos que opera com uma Visão de Dono absoluta. Seu objetivo final é gerar inteligência de negócio para garantir propostas competitivas, maximizar a lucratividade e entregar valor e segurança ao cliente.
Seus princípios de atuação são (VOCÊ DEVE APLICAR ESTES PRINCÍPIOS EM SUA ANÁLISE):
*   Busca pelo Custo-Benefício Ótimo: Seu foco é ser competitivo. Você deve sempre buscar a solução mais econômica possível, desde que ela respeite integralmente as normas técnicas e as recomendações dos fabricantes. Seu objetivo é garantir bons preços para ganhar mais obras e assegurar uma margem de lucro saudável através da precisão técnica.
*   Engenharia de Valor como Ferramenta Estratégica: Você entende que o menor preço nem sempre é a melhor solução. Você deve ser capaz de propor alternativas de maior valor agregado que, mesmo que mais caras, ofereçam maior durabilidade, segurança ou performance, justificando o investimento e diferenciando nossa proposta da concorrência.
*   Foco Obsessivo em Mitigação de Riscos: Sua primeira prioridade é identificar e neutralizar qualquer risco (técnico, executivo, logístico ou de escopo) antes que ele se materialize em prejuízo, retrabalho ou atraso.
*   Precisão como Vantagem Competitiva: Seu trabalho é apurar os custos com a máxima precisão possível. Isso permite negociar com mais agressividade, ter uma margem de lucro clara e ganhar mais projetos por apresentar propostas tecnicamente superiores e financeiramente mais seguras.
*   Consultor, Não Calculista: Você atua como um consultor técnico para o seu cliente (eu), explicando o "porquê" de cada decisão, educando sobre os riscos e guiando para a melhor solução técnica e comercial.

2.0 AÇÃO: ANÁLISE TÉCNICA INICIAL
Com base no escopo fornecido, execute uma análise técnica inicial completa, incorporando integralmente a persona e os objetivos descritos acima. Sua análise deve ser estruturada nos seguintes pontos, e retornada APENAS como um único objeto JSON válido:

**Estrutura do JSON de Saída:**
{
  "projectName": "string ou null",
  "clientName": "string ou null",
  "deadline": "string 'YYYY-MM-DD' ou null",
  "priority": "'Alta'|'Média'|'Baixa' ou null",
  "briefingSummary": "string",
  "services": [ { "id": "serv-1", "nome": "string", "quantidade": number, "unidade": "string" }, ... ],
  "doubts": [ { "id": "dbt-1", "question": "string" }, ... ],
  "keyMaterials": ["string", ...],
  "valueEngineering": ["string", ...],
  "preliminaryRisks": ["string", ...]
}

**Instruções Detalhadas para cada campo do JSON:**

- **Dados do Projeto**: Extraia 'projectName', 'clientName', 'deadline' (formato YYYY-MM-DD), e 'priority' ('Alta', 'Média', 'Baixa'). Se não encontrar, use null.
- **Resumo (briefingSummary)**: Crie um resumo técnico conciso do projeto.
- **Lista de Serviços (services)**: Transforme cada item do escopo em um objeto com "id", "nome", "quantidade" (número), e "unidade".

- **Dúvidas Técnicas (doubts)**: Gere uma lista de dúvidas técnicas essenciais. Vá além do óbvio, antecipando problemas. Cubra os seguintes pontos com exemplos robustos:
    - **Especificações Detalhadas:**
        - Exemplo (Impermeabilização): 'Qual o sistema de impermeabilização desejado para la área úmida? Argamassa polimérica, manta asfáltica ou membrana de PU? A base receberá regularização com caimento prévio?'
        - Exemplo (Pisos): 'Para o contrapiso, qual a espessura final e o FCK desejado? Será armado com tela? Qual o tipo e a malha da tela?'
        - Exemplo (Acabamentos): 'Para a pintura, qual o tipo de tinta (acrílica, epóxi) e o padrão de acabamento (fosco, acetinado)? A superfície exige massa corrida acrílica ou PVA?'
    - **Métodos de Execução:**
        - Exemplo (Demolição): 'A demolição da alvenaria é em área ocupada? Exige controle de pó e vibração, sugerindo o uso de corte com disco diamantado em vez de martelete?'
        - Exemplo (Instalação): 'A instalação do porcelanato de grande formato será sobre base existente? A base está perfeitamente nivelada ou devemos prever uma camada de autonivelante para garantir a qualidade?'
    - **Limites do Escopo:**
        - Exemplo (Elétrica): 'O escopo de "instalação de luminárias" inclui a passagem da fiação elétrica desde o quadro ou apenas a conexão no ponto já existente?'
        - Exemplo (Ar Condicionado): 'A "preparação para ar condicionado" inclui o dreno, o ponto elétrico e o furo na alvenaria/caixilho, ou apenas um deles?'
    - **Logística e Condições do Local:**
        - Exemplo: 'A obra será em andar alto? Há elevador de carga disponível? Quais as suas dimensões e capacidade? Quais as restrições de horário para ruído e entrega de materiais no condomínio?'
    - **Serviços Interdependentes (Omitidos):**
        - Exemplo (Pisos): 'A execução do novo contrapiso exigirá a remoção e reinstalação das soleiras das portas existentes?'
        - Exemplo (Forros): 'A execução de alvenaria nova demandará a recomposição do forro de gesso nos encontros para um acabamento perfeito?'
        - Exemplo (Impermeabilização): 'A impermeabilização da laje contempla a execução da proteção mecânica posteriormente, ou este é um item à parte?'

- **Materiais Principais (keyMaterials)**: Identifique e liste os insumos-chave que terão o maior impacto no custo e, principalmente, na logística do projeto.

- **Oportunidades de Engenharia de Valor (valueEngineering)**: Com base no escopo, liste ideias e oportunidades para otimização de custo, prazo ou performance. O objetivo nesta fase é levantar pontos para discussão. Siga o formato dos exemplos abaixo:
    - Exemplo: Avaliar a possibilidade de reuso de materiais de demolição (ex: perfis metálicos, se em bom estado e compatíveis) para reduzir custos de descarte e compra de novos.
    - Exemplo: Propor a utilização de um sistema de forro de gesso removível em áreas específicas que demandem manutenção frequente de instalações, otimizando futuros acessos e reduzindo custos de reparo.
    - Exemplo: Estudar a especificação do isolamento acústico para as paredes, buscando um balanço entre desempenho acústico e custo, considerando as necessidades reais do ambiente.

- **Riscos Preliminares (preliminaryRisks)**: Com sua Visão de Dono, identifique e liste os principais riscos (Técnicos, Logísticos, De Escopo ou De Segurança) que você, como responsável final pela obra, estaria mais preocupado em mitigar desde o primeiro dia.
`;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreviewUrl(null);
    }, [imageFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleAnalyze = async () => {
        if (!textScope && !imageFile) return;
        setIsLoading(true);
        setError('');
        try {
            let result = '';
            if (imageFile) {
                const imagePrompt = `A imagem contém um escopo de projeto. O texto a seguir fornece contexto adicional. Analise ambos para executar o comando.\n\nContexto: ${textScope}\n\nComando: ${command}`;
                result = await analyzeImage(imagePrompt, imageFile);
            } else {
                const fullPrompt = `${textScope}\n\nComando: ${command}`;
                result = await analyzeText(fullPrompt);
            }

            const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = result.match(jsonRegex);
            let textToParse = result;

            if (match && match[1]) {
                textToParse = match[1];
            }

            try {
                const jsonData: ParsedAnalysis = JSON.parse(textToParse);
                onAdvance(jsonData);
            } catch (e) {
                console.error("Failed to parse JSON from analysis:", e);
                setError("Não foi possível processar a resposta da IA. O formato do JSON é inválido. Tente novamente.");
            }

        } catch (error) {
            console.error(error);
            setError('Ocorreu um erro ao analisar o escopo. Verifique o console para mais detalhes.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto flex flex-col relative">
            {isLoading && (
                <div className="fixed inset-0 bg-light-bg/80 dark:bg-gray-900/80 flex flex-col items-center justify-center z-50">
                    <Spinner className="w-12 h-12" />
                    <h2 className="text-xl font-semibold dark:text-white mt-4">Analisando escopo...</h2>
                    <p className="text-gray-600 dark:text-gray-400">Aguarde, a IA está processando as informações.</p>
                </div>
            )}
             <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col flex-1">
                     <h2 className="text-xl font-bold mb-4 dark:text-white">Iniciar Nova Análise de Escopo</h2>
                     <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                         Cole o escopo bruto no campo de texto e/ou envie uma imagem. A IA irá extrair os serviços, gerar dúvidas e identificar oportunidades.
                     </p>
                     
                     <textarea 
                        value={textScope} 
                        onChange={(e) => setTextScope(e.target.value)} 
                        rows={20} 
                        className="w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 flex-grow" 
                        placeholder="Cole aqui o texto do escopo ou use-o para dar contexto à imagem..."
                     />
                     
                    <div className="mt-4">
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <img src={previewUrl} alt="Preview do escopo" className="mx-auto h-32 w-auto rounded-md" />
                                        <div 
                                            onClick={() => setImageFile(null)} 
                                            className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                                <span>Carregar um arquivo</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                                            </label>
                                            <p className="pl-1">ou arraste e solte</p>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, GIF até 10MB</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                     {error && <p className="text-sm text-danger mt-2">{error}</p>}

                     <div className="mt-6">
                        <Button onClick={handleAnalyze} className="w-full" isLoading={isLoading} disabled={(!textScope && !imageFile) || isLoading}>
                            Analisar e Criar Projeto
                        </Button>
                     </div>
                 </div>
             </div>
        </div>
    );
};

import React, { useState, useMemo } from 'react';
import type { Composicao, ComposicaoInsumo, ComposicaoMaoDeObra } from '../types';
import { Button, SearchIcon, Spinner, Modal, TrashIcon, ClipboardIcon } from './Shared';
import { parseCompositions, reviseParsedComposition, type ParsedComposicao, findRelevantCompositionsInBatch, type BatchRelevanceResult, exportCompositionToMarkdown } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


type ReviewableComposicao = ParsedComposicao & {
    reviewState: {
        isRevising: boolean;
        instruction: string;
        grupo: string;
        subgrupo: string;
    }
};

// --- Full, Read-Only Detail Display for Modal View ---
// FIX: Export the component to make it available for import in other files.
export const FullCompositionDetailView: React.FC<{ composition: Composicao, onCopyToClipboard: () => void }> = ({ composition, onCopyToClipboard }) => {
    
    const Section = ({ title, children, noTextColor = false }: { title: string, children?: React.ReactNode, noTextColor?: boolean }) => (
        <div className="py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-quantisa-blue dark:text-blue-400 border-b-2 border-quantisa-blue dark:border-blue-400 pb-1 mb-3">{title}</h3>
            <div className={`space-y-2 ${noTextColor ? '' : 'text-gray-800 dark:text-gray-300'}`}>{children}</div>
        </div>
    );
    
    const Table = ({ headers, children }: { headers: string[], children?: React.ReactNode }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-slate-200 dark:bg-slate-700">
                    <tr>{headers.map(h => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">{children}</tbody>
            </table>
        </div>
    );
    
    const renderInsumoRow = (insumo: ComposicaoInsumo, i: number) => (
         <tr key={i}><td className="px-4 py-1">{insumo.item}</td><td className="px-4 py-1">{insumo.unidade}</td><td className="px-4 py-1">{insumo.quantidade?.toFixed(3)}</td><td className="px-4 py-1 font-mono">{insumo.valorUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{insumo.valorTotal?.toFixed(2)}</td></tr>
    );

    return (
        <div className="p-2 text-base font-sans">
            {/* Header */}
            <div className="flex justify-between items-start">
                 <div>
                    <p className="font-bold text-xl text-primary">{composition.codigo} - {composition.titulo}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <span><strong>Unidade:</strong> {composition.unidade}</span>
                        <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia}</span>
                        <span><strong>Grupo:</strong> {composition.grupo}</span>
                        <span><strong>Subgrupo:</strong> {composition.subgrupo}</span>
                    </div>
                </div>
                 <Button
                    onClick={onCopyToClipboard}
                    className="!bg-blue-100 dark:!bg-blue-200 !text-slate-900 dark:!text-slate-900 hover:!bg-blue-200 dark:hover:!bg-blue-300 font-semibold !px-2 !py-1.5 !rounded-md !text-base !shadow-none gap-2"
                >
                    <ClipboardIcon className="w-5 h-5" />
                    Copiar Composição (Markdown)
                </Button>
            </div>
            
            {/* Sections */}
            <Section title="1. Premissas Técnicas e de Escopo">
                 <p><strong>Escopo:</strong> {composition.premissas?.escopo}</p>
                 <p><strong>Método:</strong> {composition.premissas?.metodo}</p>
                 <p><strong>Incluso:</strong> {composition.premissas?.incluso}</p>
                 <p><strong>Não Incluso:</strong> {composition.premissas?.naoIncluso}</p>
            </Section>
            
            <Section title={`2. Lista de Insumos (Coeficientes para 1,00 ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">2.1 Materiais</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.materiais?.map(renderInsumoRow)}
                </Table>
                <h4 className="font-semibold text-sm mt-4 mb-1 text-gray-700 dark:text-gray-300">2.2 Equipamentos</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.equipamentos?.map(renderInsumoRow)}
                </Table>
            </Section>
            
            <Section title={`3. Estimativa de Mão de Obra (HH) (para 1,00 ${composition.unidade})`}>
                 <Table headers={['Função', 'HH/Unidade', 'Custo Unit.', 'Custo Total']}>
                     {composition.maoDeObra?.map((mo, i) => (
                         <tr key={i}><td className="px-4 py-1">{mo.funcao}</td><td className="px-4 py-1">{mo.hhPorUnidade}</td><td className="px-4 py-1 font-mono">{mo.custoUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.custoTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>

             <Section title={`4. Quantitativos Consolidados (para ${composition.quantidadeReferencia} ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">4.1 Lista de Compra de Materiais</h4>
                 <Table headers={['Item', 'Un. Compra', 'Qtd. Bruta', 'Qtd. a Comprar', 'Custo Estimado']}>
                     {composition.quantitativosConsolidados?.listaCompraMateriais?.map((item, i) => (
                         <tr key={i}><td className="px-4 py-1">{item.item}</td><td className="px-4 py-1">{item.unidadeCompra}</td><td className="px-4 py-1">{item.quantidadeBruta?.toFixed(2)}</td><td className="px-4 py-1">{item.quantidadeAComprar}</td><td className="px-4 py-1 font-mono">{item.custoTotalEstimado?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="5. Indicadores Chave de Custo e Planejamento">
                 <Table headers={['Indicador', 'Unidade', `Valor (por ${composition.unidade})`, `Valor Total (para ${composition.quantidadeReferencia} ${composition.unidade})`]}>
                    {composition.indicadores && Object.entries(composition.indicadores).map(([key, value]) => {
                        if (key === 'maoDeObraDetalhada') return null;
                        const label = key.replace(/_/g, ' ').replace(/porUnidade|total/, '').replace(/\b\w/g, l => l.toUpperCase());
                        if (key.endsWith('_porUnidade')) {
                             const totalKey = key.replace('_porUnidade', '_total') as keyof typeof composition.indicadores;
                             const totalValue = composition.indicadores?.[totalKey];
                            return (
                                <tr key={key}><td className="px-4 py-1 font-semibold">{label}</td><td className="px-4 py-1">{typeof value === 'number' ? 'R$' : ''}</td><td className="px-4 py-1 font-mono">{typeof value === 'number' ? value.toFixed(2) : ''}</td><td className="px-4 py-1 font-mono">{typeof totalValue === 'number' ? totalValue.toFixed(2) : ''}</td></tr>
                            )
                        }
                        return null;
                    })}
                     {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                         <tr key={mo.funcao}><td className="px-4 py-1 font-semibold">{mo.funcao}</td><td className="px-4 py-1">HH</td><td className="px-4 py-1 font-mono">{mo.hhPorUnidade?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.hhTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="6. Guias, Segurança e Qualidade">
                <p><strong>Dicas de Execução:</strong> {composition.guias?.dicasExecucao}</p>
                <p><strong>Alertas de Segurança:</strong> {composition.guias?.alertasSeguranca}</p>
                <p><strong>Critérios de Qualidade:</strong> {composition.guias?.criteriosQualidade}</p>
            </Section>

            <Section title="7. Análise Técnica do Engenheiro" noTextColor>
                <div className="prose dark:prose-invert max-w-none text-sm">
                     <div>
                        <p><strong>Nota:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.nota || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Fontes e Referências:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.fontesReferencias || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Quadro de Produtividade:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.quadroProdutividade || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Análise e Recomendação:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.analiseRecomendacao || ''}</ReactMarkdown>
                    </div>
                </div>
            </Section>
        </div>
    );
};


// --- Full Detail Display for Review ---
const CompositionDetailDisplay: React.FC<{
    composition: ReviewableComposicao;
    index: number;
    onRequestRevision: (index: number, instruction: string) => void;
    onFieldChange: (index: number, field: 'instruction' | 'grupo' | 'subgrupo', value: string) => void;
}> = ({ composition, index, onRequestRevision, onFieldChange }) => {

    const Section = ({ title, children, noTextColor = false }: { title: string, children?: React.ReactNode, noTextColor?: boolean }) => (
        <div className="py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-quantisa-blue dark:text-blue-400 border-b-2 border-quantisa-blue dark:border-blue-400 pb-1 mb-3">{title}</h3>
            <div className={`space-y-2 ${noTextColor ? '' : 'text-gray-800 dark:text-gray-300'}`}>{children}</div>
        </div>
    );
    
    const Table = ({ headers, children }: { headers: string[], children?: React.ReactNode }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-slate-200 dark:bg-slate-700">
                    <tr>{headers.map(h => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-gray-100">{children}</tbody>
            </table>
        </div>
    );
    
    const renderInsumoRow = (insumo: ComposicaoInsumo, i: number) => (
         <tr key={i}><td className="px-4 py-1">{insumo.item}</td><td className="px-4 py-1">{insumo.unidade}</td><td className="px-4 py-1">{insumo.quantidade?.toFixed(3)}</td><td className="px-4 py-1 font-mono">{insumo.valorUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{insumo.valorTotal?.toFixed(2)}</td></tr>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 text-base font-sans">
            {/* Header */}
            <div>
                {/* FIX: The 'codigo' property does not exist on the 'ReviewableComposicao' type because it is generated later. Displaying 'CÓDIGO PENDENTE' is the correct behavior during the review stage. */}
                <p className="font-bold text-xl text-primary">{'CÓDIGO PENDENTE'} - {composition.titulo}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <span><strong>Unidade:</strong> {composition.unidade}</span>
                    <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia}</span>
                    <span><strong>Grupo:</strong> {composition.grupo}</span>
                    <span><strong>Tags:</strong> {composition.tags?.join(', ')}</span>
                    <span><strong>Classificação:</strong> {composition.classificacaoInterna}</span>
                </div>
            </div>

            {/* Import Note & Code Sugestion */}
            {composition.analiseEngenheiro?.notaDaImportacao && (
                <div className="my-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-md">
                    <h4 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">Nota da Importação (IA):</h4>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap mt-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro.notaDaImportacao}</ReactMarkdown>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Grupo Sugerido (Editar)</label>
                            <input type="text" value={composition.reviewState.grupo} onChange={e => onFieldChange(index, 'grupo', e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 p-2" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Subgrupo Sugerido (Editar)</label>
                             <input type="text" value={composition.reviewState.subgrupo} onChange={e => onFieldChange(index, 'subgrupo', e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 p-2" />
                        </div>
                    </div>
                </div>
            )}

            <Section title="1. Premissas Técnicas e de Escopo">
                 <p><strong>Escopo:</strong> {composition.premissas?.escopo}</p>
                 <p><strong>Método:</strong> {composition.premissas?.metodo}</p>
                 <p><strong>Incluso:</strong> {composition.premissas?.incluso}</p>
                 <p><strong>Não Incluso:</strong> {composition.premissas?.naoIncluso}</p>
            </Section>
            
            <Section title={`2. Lista de Insumos (Coeficientes para 1,00 ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">2.1 Materiais</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.materiais?.map(renderInsumoRow)}
                </Table>
                <h4 className="font-semibold text-sm mt-4 mb-1 text-gray-700 dark:text-gray-300">2.2 Equipamentos</h4>
                <Table headers={['Item', 'Un.', 'Qtd.', 'V.U.', 'V.T.']}>
                    {composition.insumos?.equipamentos?.map(renderInsumoRow)}
                </Table>
            </Section>
            
            <Section title={`3. Estimativa de Mão de Obra (HH) (para 1,00 ${composition.unidade})`}>
                 <Table headers={['Função', 'HH/Unidade', 'Custo Unit.', 'Custo Total']}>
                     {composition.maoDeObra?.map((mo, i) => (
                         <tr key={i}><td className="px-4 py-1">{mo.funcao}</td><td className="px-4 py-1">{mo.hhPorUnidade}</td><td className="px-4 py-1 font-mono">{mo.custoUnitario?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.custoTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>

             <Section title={`4. Quantitativos Consolidados (para ${composition.quantidadeReferencia} ${composition.unidade})`}>
                <h4 className="font-semibold text-sm mt-3 mb-1 text-gray-700 dark:text-gray-300">4.1 Lista de Compra de Materiais</h4>
                 <Table headers={['Item', 'Un. Compra', 'Qtd. Bruta', 'Qtd. a Comprar', 'Custo Estimado']}>
                     {composition.quantitativosConsolidados?.listaCompraMateriais?.map((item, i) => (
                         <tr key={i}><td className="px-4 py-1">{item.item}</td><td className="px-4 py-1">{item.unidadeCompra}</td><td className="px-4 py-1">{item.quantidadeBruta?.toFixed(2)}</td><td className="px-4 py-1">{item.quantidadeAComprar}</td><td className="px-4 py-1 font-mono">{item.custoTotalEstimado?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="5. Indicadores Chave de Custo e Planejamento">
                 <Table headers={['Indicador', 'Unidade', `Valor (por ${composition.unidade})`, `Valor Total (para ${composition.quantidadeReferencia} ${composition.unidade})`]}>
                    {composition.indicadores && Object.entries(composition.indicadores).map(([key, value]) => {
                        if (key === 'maoDeObraDetalhada') return null;
                        const label = key.replace(/_/g, ' ').replace(/porUnidade|total/, '').replace(/\b\w/g, l => l.toUpperCase());
                        if (key.endsWith('_porUnidade')) {
                             const totalKey = key.replace('_porUnidade', '_total') as keyof typeof composition.indicadores;
                             const totalValue = composition.indicadores?.[totalKey];
                            return (
                                <tr key={key}><td className="px-4 py-1 font-semibold">{label}</td><td className="px-4 py-1">{typeof value === 'number' ? 'R$' : ''}</td><td className="px-4 py-1 font-mono">{typeof value === 'number' ? value.toFixed(2) : ''}</td><td className="px-4 py-1 font-mono">{typeof totalValue === 'number' ? totalValue.toFixed(2) : ''}</td></tr>
                            )
                        }
                        return null;
                    })}
                     {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                         <tr key={mo.funcao}><td className="px-4 py-1 font-semibold">{mo.funcao}</td><td className="px-4 py-1">HH</td><td className="px-4 py-1 font-mono">{mo.hhPorUnidade?.toFixed(2)}</td><td className="px-4 py-1 font-mono">{mo.hhTotal?.toFixed(2)}</td></tr>
                     ))}
                 </Table>
            </Section>
            
            <Section title="6. Guias, Segurança e Qualidade">
                <p><strong>Dicas de Execução:</strong> {composition.guias?.dicasExecucao}</p>
                <p><strong>Alertas de Segurança:</strong> {composition.guias?.alertasSeguranca}</p>
                <p><strong>Critérios de Qualidade:</strong> {composition.guias?.criteriosQualidade}</p>
            </Section>

            <Section title="7. Análise Técnica do Engenheiro" noTextColor>
                <div className="prose dark:prose-invert max-w-none">
                    <div>
                        <p><strong>Nota:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.nota || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Fontes e Referências:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.fontesReferencias || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Quadro de Produtividade:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.quadroProdutividade || ''}</ReactMarkdown>
                    </div>
                     <div>
                        <p><strong>Análise e Recomendação:</strong></p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{composition.analiseEngenheiro?.analiseRecomendacao || ''}</ReactMarkdown>
                    </div>
                </div>
            </Section>


            {/* Revision Block */}
            <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruções de Correção</label>
                <textarea
                    value={composition.reviewState.instruction}
                    onChange={(e) => onFieldChange(index, 'instruction', e.target.value)}
                    rows={2}
                    className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    placeholder="Se houver erros, descreva a correção aqui. Ex: 'O custo do cimento está errado, use R$32,50'..."
                />
                <div className="text-right mt-2">
                    <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => onRequestRevision(index, composition.reviewState.instruction)}
                        isLoading={composition.reviewState.isRevising}
                    >
                        Revisar com IA
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- Summary Card for Search View ---
const CompositionSummaryCard: React.FC<{ 
    composition: Composicao,
    onViewDetails: () => void,
    onDelete: () => void
}> = ({ composition, onViewDetails, onDelete }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 group transition-shadow hover:shadow-xl">
            <div className="p-4">
                 <div 
                    className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-2 mb-3 cursor-pointer"
                    onClick={onViewDetails}
                >
                    <div>
                        <p className="font-mono text-sm text-primary group-hover:underline">{composition.codigo}</p>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{composition.titulo}</h3>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 p-1 rounded-full"
                        aria-label={`Excluir composição ${composition.titulo}`}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
                 <div 
                    className="space-y-4 cursor-pointer"
                    onClick={onViewDetails}
                >
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span><strong>Unidade:</strong> {composition.unidade}</span>
                        <span><strong>Qtd. Ref:</strong> {composition.quantidadeReferencia} {composition.unidade}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📋 PREMISSAS & ESCOPO</h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 italic space-y-1">
                            <p><strong>Escopo:</strong> {composition.premissas?.escopo}</p>
                            <p><strong>Método:</strong> {composition.premissas?.metodo}</p>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">📊 INDICADORES-CHAVE (por {composition.unidade})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-300">
                            <span><strong>Mat:</strong> R$ {composition.indicadores?.custoMateriais_porUnidade?.toFixed(2)}</span>
                            <span><strong>M.O.:</strong> R$ {composition.indicadores?.custoMaoDeObra_porUnidade?.toFixed(2)}</span>
                            <span><strong>Equip:</strong> R$ {composition.indicadores?.custoEquipamentos_porUnidade?.toFixed(2)}</span>
                             {composition.indicadores?.maoDeObraDetalhada?.map(mo => (
                                <span key={mo.funcao}><strong>{mo.funcao.match(/\(([^)]+)\)/)?.[1] || mo.funcao.split(' ')[0]}:</strong> {mo.hhPorUnidade?.toFixed(2)} HH</span>
                            ))}
                            <span><strong>Peso:</strong> {composition.indicadores?.pesoMateriais_porUnidade?.toFixed(2)} kg</span>
                            <span><strong>Entulho:</strong> {composition.indicadores?.volumeEntulho_porUnidade?.toFixed(3)} m³</span>
                        </div>
                    </div>
                    <div className="text-right pt-2">
                        <span className="font-bold text-primary dark:text-indigo-400 text-sm hover:underline">
                            Ver Detalhes Completos
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

type ImportStage = 'input' | 'similarity_check' | 'review_and_confirm';

// --- NEW Similarity Check View ---
const SimilarityCheckView: React.FC<{
    parsedCompositions: (ParsedComposicao & { id: string })[];
    relevanceResults: BatchRelevanceResult[];
    onProceed: (compositionsToReview: ParsedComposicao[]) => void;
    onCancel: () => void;
}> = ({ parsedCompositions, relevanceResults, onProceed, onCancel }) => {
    const [decisions, setDecisions] = useState<Record<string, 'add' | 'discard'>>(() =>
        Object.fromEntries(parsedCompositions.map(c => [c.id, 'add']))
    );

    const handleDecisionChange = (id: string, decision: 'add' | 'discard') => {
        setDecisions(prev => ({ ...prev, [id]: decision }));
    };

    const handleProceed = () => {
        const toReview = parsedCompositions.filter(c => decisions[c.id] === 'add');
        onProceed(toReview);
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Verificação de Similaridade</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">A IA analisou suas composições e encontrou algumas similares já existentes. Decida para cada item se deseja adicioná-lo como novo ou descartá-lo.</p>

            <div className="space-y-3">
                {parsedCompositions.map(comp => {
                    const result = relevanceResults.find(r => r.idNovaComposicao === comp.id);
                    return (
                        <div key={comp.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">Nova Composição: <span className="text-primary">{comp.titulo}</span></h3>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name={`decision-${comp.id}`} checked={decisions[comp.id] === 'add'} onChange={() => handleDecisionChange(comp.id, 'add')} className="text-primary focus:ring-primary" />Adicionar</label>
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name={`decision-${comp.id}`} checked={decisions[comp.id] === 'discard'} onChange={() => handleDecisionChange(comp.id, 'discard')} className="text-primary focus:ring-primary" />Descartar</label>
                                    </div>
                                </div>

                                <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Candidatos Similares Encontrados:</h4>
                                    {result && result.candidatos.length > 0 ? (
                                        <ul className="mt-2 space-y-3">
                                            {result.candidatos.map(cand => (
                                                <li key={cand.idExistente} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                                                    <p className="font-bold text-slate-900 dark:text-slate-50 text-lg">{cand.titulo}</p>
                                                    <p className="italic text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                                                        <strong>Escopo:</strong> {cand.escopoResumido}
                                                    </p>
                                                    <p className="text-sm text-green-700 dark:text-green-500 mt-2"><span className="font-bold">{cand.relevanciaScore}%</span> - {cand.motivo}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Nenhuma composição similar encontrada.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-end items-center gap-4">
                <Button variant="secondary" onClick={onCancel}>Cancelar Importação</Button>
                <Button size="lg" onClick={handleProceed}>Prosseguir para Revisão</Button>
            </div>
        </div>
    );
};


export const CompositionsView: React.FC<{
    composicoes: Composicao[];
    setComposicoes: React.Dispatch<React.SetStateAction<Composicao[]>>;
    showToast: (message: string, type?: 'success' | 'error') => void;
}> = ({ composicoes, setComposicoes, showToast }) => {
    const [activeTab, setActiveTab] = useState<'importar' | 'pesquisar'>('importar');
    const [compositionText, setCompositionText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [importStage, setImportStage] = useState<ImportStage>('input');
    const [parsedCompositions, setParsedCompositions] = useState<(ParsedComposicao & { id: string })[]>([]);
    const [relevanceResults, setRelevanceResults] = useState<BatchRelevanceResult[]>([]);
    const [composicoesParaRevisao, setComposicoesParaRevisao] = useState<ReviewableComposicao[] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [compositionToDelete, setCompositionToDelete] = useState<Composicao | null>(null);
    const [compositionToView, setCompositionToView] = useState<Composicao | null>(null);

    const filteredCompositions = useMemo(() => {
        if (!searchQuery) return composicoes;
        return composicoes.filter(c => 
            c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.codigo.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [composicoes, searchQuery]);
    
    const handleCopyToClipboard = (composition: Composicao) => {
        const markdown = exportCompositionToMarkdown(composition);
        navigator.clipboard.writeText(markdown);
        showToast("Composição copiada para a área de transferência!");
    };

    const handleConfirmDelete = () => {
        if (!compositionToDelete) return;
        setComposicoes(prev => prev.filter(c => c.id !== compositionToDelete.id));
        showToast(`Composição "${compositionToDelete.titulo}" excluída com sucesso.`);
        setCompositionToDelete(null);
    };

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        textarea.style.height = 'auto'; // Reset height to recalculate
        textarea.style.height = `${textarea.scrollHeight}px`;
    };
    
    const resetImportFlow = () => {
        setImportStage('input');
        setCompositionText('');
        setParsedCompositions([]);
        setRelevanceResults([]);
        setComposicoesParaRevisao(null);
    };


    const handleProcessar = async () => {
        if (!compositionText.trim()) {
            showToast("O campo de texto não pode estar vazio.", 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const parsed = await parseCompositions(compositionText);

            const isInvalidInputAlert =
                parsed.length > 0 &&
                !parsed[0].titulo &&
                parsed[0].analiseEngenheiro?.notaDaImportacao?.includes('Alerta:');

            if (isInvalidInputAlert) {
                showToast(parsed[0].analiseEngenheiro!.notaDaImportacao!, 'error');
                setIsProcessing(false);
                return;
            }

            const parsedWithIds = parsed.map((p, i) => ({ ...p, id: `temp-${i}` }));
            setParsedCompositions(parsedWithIds);
            
            const relevance = await findRelevantCompositionsInBatch(parsedWithIds, composicoes);
            setRelevanceResults(relevance);
            
            setImportStage('similarity_check');

        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleProceedToReview = (compositionsToReview: ParsedComposicao[]) => {
         const reviewable = compositionsToReview.map(p => {
            const suggestedGrupo = p.grupo || 'GERAL';
            const suggestedSubgrupo = p.subgrupo || 'GERAL';

            return {
                ...p,
                reviewState: {
                    isRevising: false,
                    instruction: '',
                    grupo: suggestedGrupo,
                    subgrupo: suggestedSubgrupo,
                }
            }
        });

        if (reviewable.length > 0) {
            setComposicoesParaRevisao(reviewable);
            setImportStage('review_and_confirm');
        } else {
            showToast("Nenhuma nova composição para adicionar.", 'success');
            resetImportFlow();
        }
    };

    const handleFieldChange = (index: number, field: 'instruction' | 'grupo' | 'subgrupo', value: string) => {
        setComposicoesParaRevisao(prev => {
            if (!prev) return null;
            const newComps = [...prev];
            newComps[index].reviewState[field] = value;
            return newComps;
        });
    };

    const handleRequestRevision = async (index: number, instruction: string) => {
        if (!composicoesParaRevisao) return;

        setComposicoesParaRevisao(prev => {
            if (!prev) return null;
            const newComps = [...prev];
            newComps[index].reviewState.isRevising = true;
            return newComps;
        });

        try {
            const composicaoOriginal: ParsedComposicao = { ...composicoesParaRevisao[index] };
            delete (composicaoOriginal as any).reviewState;
            
            const revised = await reviseParsedComposition(composicaoOriginal, instruction);
            
            setComposicoesParaRevisao(prev => {
                if (!prev) return null;
                const newComps = [...prev];
                const oldReviewState = newComps[index].reviewState;
                newComps[index] = { ...revised, reviewState: { ...oldReviewState, isRevising: false, instruction: '' } };
                return newComps;
            });
            showToast(`Composição revisada com sucesso.`);
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu na revisão.", 'error');
            setComposicoesParaRevisao(prev => {
                 if (!prev) return null;
                const newComps = [...prev];
                newComps[index].reviewState.isRevising = false;
                return newComps;
            });
        }
    };
    
    const handleSalvar = () => {
        if (!composicoesParaRevisao) return;

        const novasComposicoes: Composicao[] = composicoesParaRevisao.map(comp => {
            const maxSeq = composicoes
                .filter(c => c.grupo === comp.reviewState.grupo && c.subgrupo === comp.reviewState.subgrupo)
                .map(c => parseInt(c.codigo.split('-')[2], 10))
                .reduce((max, current) => Math.max(max, current), 0);
            
            const newSeq = (maxSeq + 1).toString().padStart(2, '0');
            const newCode = `${comp.reviewState.grupo}-${comp.reviewState.subgrupo}-${newSeq}`;

            const finalComp: Partial<Composicao> = { ...comp };
            delete (finalComp as any).reviewState;
            
            return {
                ...finalComp,
                id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                codigo: newCode,
                grupo: comp.reviewState.grupo,
                subgrupo: comp.reviewState.subgrupo,
            } as Composicao;
        });
        
        setComposicoes(prev => [...prev, ...novasComposicoes]);
        showToast(`${novasComposicoes.length} nova(s) composição(ões) salva(s) com sucesso!`);
        
        resetImportFlow();
        setActiveTab('pesquisar');
    };

    const TabButton = ({ label, id, active }: { label: string, id: 'importar' | 'pesquisar', active: boolean }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${active ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    const renderImportContent = () => {
        switch (importStage) {
            case 'input':
                return (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Importar Novas Composições</h2>
                        <textarea
                            value={compositionText}
                            onChange={(e) => setCompositionText(e.target.value)}
                            onInput={handleTextareaInput}
                            style={{ minHeight: '300px' }}
                            className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 resize-none overflow-hidden"
                            placeholder="Cole o texto das composições aqui..."
                        />
                        <div className="mt-4 text-right">
                            <Button onClick={handleProcessar} isLoading={isProcessing}>
                                {isProcessing ? 'Processando...' : 'Processar e Verificar Similaridade'}
                            </Button>
                        </div>
                    </div>
                );
            case 'similarity_check':
                 return (
                    <SimilarityCheckView
                        parsedCompositions={parsedCompositions}
                        relevanceResults={relevanceResults}
                        onProceed={handleProceedToReview}
                        onCancel={resetImportFlow}
                    />
                 );
            case 'review_and_confirm':
                 return (
                     <div>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Revisão e Confirmação</h2>
                        {composicoesParaRevisao?.map((comp, index) => (
                            <CompositionDetailDisplay
                                key={index}
                                composition={comp}
                                index={index}
                                onRequestRevision={handleRequestRevision}
                                onFieldChange={handleFieldChange}
                            />
                        ))}
                         <div className="mt-6 flex justify-between items-center">
                            <Button variant="secondary" onClick={() => setImportStage('similarity_check')}>Voltar</Button>
                            <Button size="lg" onClick={handleSalvar}>
                                Salvar Composições Aprovadas
                            </Button>
                        </div>
                    </div>
                 )
        }
    }


    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto text-base">
            <div className="max-w-screen-xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                     <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão de Composições</h1>
                     <div className="flex space-x-2 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                        <TabButton label="Pesquisar" id="pesquisar" active={activeTab === 'pesquisar'} />
                        <TabButton label="Importar" id="importar" active={activeTab === 'importar'} />
                    </div>
                </div>

                {activeTab === 'importar' && (
                    isProcessing ? (
                         <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <Spinner className="w-8 h-8 mb-4" />
                            <h3 className="text-lg font-semibold dark:text-white">Analisando Composições...</h3>
                            <p className="text-gray-600 dark:text-gray-400">Verificando similaridade com a base de dados. Isso pode levar alguns instantes.</p>
                        </div>
                    ) : (
                        renderImportContent()
                    )
                )}

                {activeTab === 'pesquisar' && (
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                         <div className="p-4 border-b dark:border-gray-700">
                            <div className="relative max-w-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SearchIcon className="text-gray-400" />
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome ou código..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                                />
                            </div>
                        </div>
                        <div className="p-6">
                            {filteredCompositions.length > 0 ? (
                                <div className="space-y-4">
                                    {filteredCompositions.map(c => (
                                        <CompositionSummaryCard 
                                            key={c.id} 
                                            composition={c} 
                                            onViewDetails={() => setCompositionToView(c)}
                                            onDelete={() => setCompositionToDelete(c)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    {searchQuery ? `Nenhuma composição encontrada para "${searchQuery}".` : 'Nenhuma composição no banco de dados. Use a aba "Importar" para adicionar.'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <Modal isOpen={!!compositionToView} onClose={() => setCompositionToView(null)} title="Detalhes da Composição" size="xl">
                {compositionToView && <FullCompositionDetailView composition={compositionToView} onCopyToClipboard={() => handleCopyToClipboard(compositionToView)} />}
            </Modal>
            
            <Modal isOpen={!!compositionToDelete} onClose={() => setCompositionToDelete(null)} title="Confirmar Exclusão" size="md">
                {compositionToDelete && (
                    <div>
                        <p className="dark:text-gray-300">Tem certeza que deseja apagar a composição "{compositionToDelete.titulo}"?</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Essa ação não pode ser desfeita.</p>
                        <div className="flex justify-end space-x-2 mt-6">
                            <Button variant="secondary" onClick={() => setCompositionToDelete(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleConfirmDelete}>Excluir</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
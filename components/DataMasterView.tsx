import React, { useState, useMemo, useCallback } from 'react';
import type { Insumo, PriceHistory } from '../types';
import { Button, SearchIcon, Spinner, Modal, Badge } from './Shared';
// FIX: import findSimilarInsumosInBatch instead of getInsumoSimilarityScore, and BatchSimilarityResult instead of SimilarityResult
import { parseInsumos, findSimilarInsumosInBatch, type BatchSimilarityResult } from '../services/geminiService';
import { MergeInsumoModal } from './MergeInsumoModal';

// FIX: Ensure id is available for mapping, as it's required by findSimilarInsumosInBatch
type ParsedInsumo = Partial<Insumo> & { id: string };

type ReviewableInsumo = ParsedInsumo & {
    action: 'new' | 'update';
    updateTargetId?: string;
};

// FIX: New type for processing queue
type ProcessingQueueItem = {
    newItem: ParsedInsumo;
    match?: BatchSimilarityResult;
};


export const DataMasterView: React.FC<{
    insumos: Insumo[];
    setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
    showToast: (message: string, type?: 'success' | 'error') => void;
}> = ({ insumos, setInsumos, showToast }) => {
    const [activeTab, setActiveTab] = useState<'pesquisar' | 'importar'>('pesquisar');
    const [searchQuery, setSearchQuery] = useState('');
    const [insumosText, setInsumosText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [insumosParaRevisao, setInsumosParaRevisao] = useState<ReviewableInsumo[]>([]);
    const [insumoForHistory, setInsumoForHistory] = useState<Insumo | null>(null);

    // States for the new merge modal flow
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [itemForReview, setItemForReview] = useState<ParsedInsumo | null>(null);
    const [potentialMatch, setPotentialMatch] = useState<Insumo | null>(null);
    // FIX: Update state to use BatchSimilarityResult
    const [similarityResult, setSimilarityResult] = useState<BatchSimilarityResult | null>(null);
    // FIX: Update queue type
    const [processingQueue, setProcessingQueue] = useState<ProcessingQueueItem[]>([]);

    const filteredInsumos = useMemo(() => {
        if (!searchQuery) return insumos;
        return insumos.filter(i => 
            i.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.tipo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (i.marca && i.marca.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [insumos, searchQuery]);
    

    const processNextInQueue = useCallback(async (queue: ProcessingQueueItem[]) => {
        if (queue.length === 0) {
            if (insumosParaRevisao.length > 0) {
                 showToast(`${insumosParaRevisao.length} insumo(s) pronto(s) para revisão.`);
            }
            setIsProcessing(false);
            return;
        }

        const [currentItem, ...restOfQueue] = queue;
        setProcessingQueue(restOfQueue);
        
        if (currentItem.match) {
            const existingInsumo = insumos.find(i => i.id === currentItem.match!.existingInsumoId);
             if (existingInsumo) {
                setItemForReview(currentItem.newItem);
                setPotentialMatch(existingInsumo);
                setSimilarityResult(currentItem.match);
                setIsMergeModalOpen(true);
                return; // Wait for user interaction
            }
        }

        // No match, or matched item not found in DB. Add as new and continue.
        setInsumosParaRevisao(prev => [...prev, { ...currentItem.newItem, action: 'new' }]);
        processNextInQueue(restOfQueue);
        
    }, [insumos, insumosParaRevisao.length, showToast]);


    const handleProcessar = async () => {
        if (!insumosText.trim()) {
            showToast("O campo de texto não pode estar vazio.", 'error');
            return;
        }
        setIsProcessing(true);
        setInsumosParaRevisao([]); // Reset review list

        try {
            const parsed = await parseInsumos(insumosText);
            // FIX: Ensure each parsed item has a temporary unique ID for matching.
            const parsedWithIds: ParsedInsumo[] = parsed.map((p, i) => ({
                ...p,
                id: p.id || `temp-${Date.now()}-${i}`
            }));


            if(parsedWithIds.length > 0) {
                const similarPairs = await findSimilarInsumosInBatch(parsedWithIds, insumos);
                
                const matchesMap = new Map<string, BatchSimilarityResult>();
                similarPairs.forEach(pair => {
                    const existingMatch = matchesMap.get(pair.newInsumoId);
                    if (!existingMatch || pair.similarityScore > existingMatch.similarityScore) {
                         matchesMap.set(pair.newInsumoId, pair);
                    }
                });

                const queue: ProcessingQueueItem[] = parsedWithIds.map(newItem => ({
                    newItem,
                    match: matchesMap.get(newItem.id)
                }));
                
                setProcessingQueue(queue);
                processNextInQueue(queue);
            } else {
                showToast("Nenhum insumo válido encontrado no texto.", 'error');
                setIsProcessing(false);
            }
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Um erro desconhecido ocorreu.", 'error');
            setIsProcessing(false);
        }
    };
    
    const handleConfirmMerge = () => {
        if (itemForReview) {
            setInsumosParaRevisao(prev => [...prev, {
                ...(itemForReview as ParsedInsumo),
                action: 'update',
                updateTargetId: potentialMatch?.id,
            }]);
        }
        setIsMergeModalOpen(false);
        processNextInQueue(processingQueue);
    };

    const handleAddNew = () => {
        if (itemForReview) {
            setInsumosParaRevisao(prev => [...prev, { ...(itemForReview as ParsedInsumo), action: 'new' }]);
        }
        setIsMergeModalOpen(false);
        processNextInQueue(processingQueue);
    };
    
     const handleSalvar = () => {
        if (insumosParaRevisao.length === 0) return;

        let itemsAdded = 0;
        let itemsUpdated = 0;

        // FIX: Explicitly type the Map to ensure correct type inference for its values. This resolves errors where properties on the map value were inferred as 'unknown'.
        const updatedInsumosMap: Map<string, Insumo> = new Map(insumos.map(i => [i.id, { ...i, priceHistory: [...i.priceHistory] }]));

        insumosParaRevisao.forEach(rev => {
            if (rev.action === 'new' && rev.nome) {
                const newInsumo: Insumo = {
                    id: rev.id || `ins-${Date.now()}-${Math.random()}`,
                    nome: rev.nome,
                    unidade: rev.unidade || 'un',
                    custo: rev.custo || 0,
                    tipo: rev.tipo || 'Material',
                    marca: rev.marca,
                    observacao: rev.observacao,
                    priceHistory: [{ date: new Date().toISOString(), cost: rev.custo || 0 }],
                };
                updatedInsumosMap.set(newInsumo.id, newInsumo);
                itemsAdded++;
            } else if (rev.action === 'update' && rev.updateTargetId) {
                const originalInsumo = updatedInsumosMap.get(rev.updateTargetId);
                if (originalInsumo) {
                    originalInsumo.custo = rev.custo || originalInsumo.custo;
                    originalInsumo.priceHistory.push({ date: new Date().toISOString(), cost: rev.custo || originalInsumo.custo });
                    itemsUpdated++;
                }
            }
        });
        
        setInsumos(Array.from(updatedInsumosMap.values()));
        showToast(`${itemsAdded} novo(s) insumo(s) adicionado(s) e ${itemsUpdated} preço(s) atualizado(s).`);
        
        setInsumosParaRevisao([]);
        setInsumosText('');
        setActiveTab('pesquisar');
    };

    const handleItemChange = (index: number, field: keyof Insumo, value: string | number) => {
        const updated = [...insumosParaRevisao];
        (updated[index] as any)[field] = value;
        setInsumosParaRevisao(updated);
    };

    const TabButton = ({ label, id, active }: { label: string, id: 'pesquisar' | 'importar', active: boolean }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${active ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    const renderImportContent = () => {
        if (isProcessing) {
             return (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Spinner className="w-8 h-8 mb-4" />
                    <h3 className="text-lg font-semibold dark:text-white">Analisando Insumos...</h3>
                    <p className="text-gray-600 dark:text-gray-400">Verificando similaridade com a base de dados. Isso pode levar alguns instantes.</p>
                </div>
            );
        }
        
        if (insumosParaRevisao.length > 0) {
            return (
                 <div>
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Revisão e Confirmação</h2>
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                            <thead className="text-left text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-2 font-medium w-[120px]">Ação</th>
                                    <th className="px-4 py-2 font-medium w-[30%]">Nome</th>
                                    <th className="px-4 py-2 font-medium w-[100px]">Tipo</th>
                                    <th className="px-4 py-2 font-medium w-[100px]">Marca</th>
                                    <th className="px-4 py-2 font-medium w-[80px]">Unidade</th>
                                    <th className="px-4 py-2 font-medium w-[110px]">Custo Unitário</th>
                                    <th className="px-4 py-2 font-medium">Observação IA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {insumosParaRevisao.map((insumo, index) => (
                                    <tr key={index}>
                                        <td className="p-2">
                                            {insumo.action === 'new' ? (
                                                <Badge color="green">Novo Item</Badge>
                                            ) : (
                                                <Badge color="yellow">Atualização de Preço</Badge>
                                            )}
                                        </td>
                                        <td className="p-1 whitespace-normal"><input type="text" value={insumo.nome || ''} onChange={e => handleItemChange(index, 'nome', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                        <td className="p-1"><input type="text" value={insumo.tipo || ''} onChange={e => handleItemChange(index, 'tipo', e.target.value as any)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                        <td className="p-1"><input type="text" value={insumo.marca || ''} onChange={e => handleItemChange(index, 'marca', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                        <td className="p-1"><input type="text" value={insumo.unidade || ''} onChange={e => handleItemChange(index, 'unidade', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                        <td className="p-1"><input type="number" value={insumo.custo || 0} onChange={e => handleItemChange(index, 'custo', parseFloat(e.target.value))} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200"/></td>
                                        <td className="p-2 text-xs text-gray-500 dark:text-gray-400 whitespace-normal">{insumo.observacao}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end items-center gap-4">
                       <Button variant="secondary" onClick={() => { setInsumosParaRevisao([]); setInsumosText(''); }}>Cancelar</Button>
                       <Button size="lg" onClick={handleSalvar}>
                           Salvar Insumos Aprovados
                       </Button>
                   </div>
                </div>
            )
        }
        
        return (
             <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">Importar Insumos em Massa</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Cole uma lista de insumos abaixo. A IA irá interpretar, extrair marcas, calcular custos unitários e classificar os tipos automaticamente.
                </p>
                <textarea
                    value={insumosText}
                    onChange={(e) => setInsumosText(e.target.value)}
                    rows={15}
                    className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    placeholder="Aditivo (Bianco ou similar); L; 25.50&#10;Argamassa Colante AC-II; kg; 1.30&#10;Locação de Betoneira 400L; diária; 120.00"
                />
                <div className="mt-4 text-right">
                    <Button onClick={handleProcessar} isLoading={isProcessing}>
                        {isProcessing ? 'Processando...' : 'Processar com IA'}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                     <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Insumos</h1>
                     <div className="flex space-x-2 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg">
                        <TabButton label="Pesquisar Insumos" id="pesquisar" active={activeTab === 'pesquisar'} />
                        <TabButton label="Importar / Adicionar" id="importar" active={activeTab === 'importar'} />
                    </div>
                </div>

                {activeTab === 'pesquisar' && (
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                        <div className="p-4 border-b dark:border-gray-700">
                           <div className="relative max-w-sm">
                               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <SearchIcon className="text-gray-400" />
                               </div>
                               <input 
                                   type="text" 
                                   placeholder="Buscar por nome, tipo ou marca..." 
                                   value={searchQuery}
                                   onChange={(e) => setSearchQuery(e.target.value)}
                                   className="w-full p-2 pl-10 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                               />
                           </div>
                       </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Nome</th>
                                        <th scope="col" className="px-6 py-3">Marca</th>
                                        <th scope="col" className="px-6 py-3">Tipo</th>
                                        <th scope="col" className="px-6 py-3">Unidade</th>
                                        <th scope="col" className="px-6 py-3">Custo Atual</th>
                                        <th scope="col" className="px-6 py-3">Observação IA</th>
                                        <th scope="col" className="px-6 py-3">Detalhes/Histórico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInsumos.map((insumo) => (
                                        <tr key={insumo.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                                {insumo.nome}
                                            </th>
                                            <td className="px-6 py-4">{insumo.marca || '--'}</td>
                                            <td className="px-6 py-4">{insumo.tipo}</td>
                                            <td className="px-6 py-4">{insumo.unidade}</td>
                                            <td className="px-6 py-4 font-mono">
                                                {insumo.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-6 py-4 text-xs">{insumo.observacao || '--'}</td>
                                            <td className="px-6 py-4">
                                                <button onClick={() => setInsumoForHistory(insumo)} className="font-medium text-primary hover:underline">Ver</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {activeTab === 'importar' && renderImportContent()}
            </div>
             <MergeInsumoModal
                isOpen={isMergeModalOpen}
                onClose={() => {
                    setIsMergeModalOpen(false);
                    processNextInQueue(processingQueue); // Continue processing queue on cancel
                }}
                newItem={itemForReview}
                existingItem={potentialMatch}
                similarityResult={similarityResult}
                onConfirmMerge={handleConfirmMerge}
                onAddNew={handleAddNew}
            />
            <Modal isOpen={!!insumoForHistory} onClose={() => setInsumoForHistory(null)} title={`Histórico de Preços: ${insumoForHistory?.nome}`}>
                {insumoForHistory && (
                    <div className="max-h-96 overflow-y-auto">
                         <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Data</th>
                                    <th className="px-4 py-2">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {insumoForHistory.priceHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, index) => (
                                    <tr key={index}>
                                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{new Date(entry.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{entry.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Modal>
        </div>
    );
};
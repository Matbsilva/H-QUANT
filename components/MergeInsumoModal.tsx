import React from 'react';
import type { Insumo } from '../types';
import { Button, Modal } from './Shared';
// FIX: Changed import to BatchSimilarityResult
import type { BatchSimilarityResult } from '../services/geminiService';

type ParsedInsumo = Partial<Insumo>;

interface MergeInsumoModalProps {
    isOpen: boolean;
    onClose: () => void;
    newItem: ParsedInsumo | null;
    existingItem: Insumo | null;
    // FIX: Changed type to BatchSimilarityResult
    similarityResult: BatchSimilarityResult | null;
    onConfirmMerge: () => void;
    onAddNew: () => void;
}

const DetailCard: React.FC<{ title: string, item: ParsedInsumo | Insumo | null, isNew?: boolean }> = ({ title, item, isNew = false }) => (
    <div className={`p-4 rounded-lg border ${isNew ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'}`}>
        <h3 className={`font-semibold mb-2 ${isNew ? 'text-blue-800 dark:text-blue-300' : 'text-gray-800 dark:text-gray-300'}`}>{title}</h3>
        <div className="space-y-1 text-sm">
            <p><strong>Nome:</strong> {item?.nome}</p>
            <p><strong>Marca:</strong> {item?.marca || '--'}</p>
            <p><strong>Unidade:</strong> {item?.unidade}</p>
            <p className="font-bold"><strong>Custo:</strong> {item?.custo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
    </div>
);


export const MergeInsumoModal: React.FC<MergeInsumoModalProps> = ({
    isOpen,
    onClose,
    newItem,
    existingItem,
    similarityResult,
    onConfirmMerge,
    onAddNew,
}) => {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Análise de Similaridade de Insumo">
            <div className="space-y-4">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                        Atenção: A IA encontrou uma similaridade de {similarityResult?.similarityScore}% entre o item que você está importando e um item já existente.
                    </p>
                     <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        <strong>Justificativa da IA:</strong> {similarityResult?.reasoning}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Novo Item (Importação)" item={newItem} isNew />
                    <DetailCard title="Item Existente (Base de Dados)" item={existingItem} />
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    O que você gostaria de fazer?
                </p>

                <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button variant="secondary" onClick={onAddNew}>
                        Adicionar como Novo Item
                    </Button>
                    <Button variant="primary" onClick={onConfirmMerge}>
                        Atualizar Preço do Existente
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
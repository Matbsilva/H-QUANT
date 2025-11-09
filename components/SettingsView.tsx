import React, { useState } from 'react';
import type { Insumo } from '../types';
import { Button } from './Shared';

interface SettingsViewProps {
    insumos: Insumo[];
    setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ insumos, setInsumos }) => {
    const [insumosText, setInsumosText] = useState('');
    const [error, setError] = useState('');

    const handleProcessar = () => {
        setError('');
        if (!insumosText.trim()) {
            setError('A lista de insumos não pode estar vazia.');
            return;
        }

        const linhas = insumosText.trim().split('\n');
        const novosInsumos: Insumo[] = [];

        for (const linha of linhas) {
            const partes = linha.split(';').map(p => p.trim());
            if (partes.length !== 3) {
                setError(`Linha mal formatada encontrada: "${linha}". Use o formato: Nome;Unidade;Custo`);
                return;
            }

            const [nome, unidade, custoStr] = partes;
            const custo = parseFloat(custoStr.replace(',', '.'));

            if (!nome || !unidade || isNaN(custo)) {
                setError(`Dados inválidos na linha: "${linha}". Verifique os valores.`);
                return;
            }

            // FIX: Added missing 'priceHistory' property to conform to the Insumo type.
            novosInsumos.push({
                id: `ins-${Date.now()}-${Math.random()}`,
                nome,
                unidade,
                custo,
                tipo: 'Material', // Simplesmente definindo um tipo padrão por enquanto
                priceHistory: [{ date: new Date().toISOString(), cost: custo }],
            });
        }
        
        // Simplesmente substitui a lista atual. Uma lógica de backend faria um "upsert".
        setInsumos(novosInsumos); 
        setInsumosText('');
        alert(`${novosInsumos.length} insumos foram processados com sucesso!`);
    };

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Configurações</h1>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Gestão de Insumos</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Cole uma lista de insumos abaixo para popular ou atualizar o Data Master.
                        Use o formato: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">Nome do Insumo;Unidade;Custo</code>. Cada insumo deve estar em uma nova linha.
                    </p>
                    
                    <textarea
                        value={insumosText}
                        onChange={(e) => setInsumosText(e.target.value)}
                        rows={10}
                        className="w-full p-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        placeholder="Tinta Acrílica;Lata 18L;325,00&#10;Cimento CP II;Saco 50kg;28,50"
                    />
                    
                    {error && <p className="text-sm text-danger mt-2">{error}</p>}
                    
                    <div className="mt-4 text-right">
                        <Button onClick={handleProcessar}>Processar e Adicionar Insumos</Button>
                    </div>

                    <div className="mt-8">
                         <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Insumos Atuais ({insumos.length})</h3>
                         <div className="max-h-64 overflow-y-auto border rounded-md dark:border-gray-700">
                             <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Nome</th>
                                        <th scope="col" className="px-6 py-3">Unidade</th>
                                        <th scope="col" className="px-6 py-3">Custo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {insumos.map((insumo) => (
                                        <tr key={insumo.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                            <td className="px-6 py-2">{insumo.nome}</td>
                                            <td className="px-6 py-2">{insumo.unidade}</td>
                                            <td className="px-6 py-2 font-mono">{insumo.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
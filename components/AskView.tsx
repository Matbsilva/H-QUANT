"use client";

import React, { useState } from 'react';
import { Button, Modal, Spinner, SearchIcon } from './Shared';
import { generateWithSearch } from '../services/geminiService';
import type { SearchResult } from '../types';

export const AskView = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!searchQuery.trim()) return;
        setIsLoading(true);
        setSearchResult(null);
        const result = await generateWithSearch(searchQuery);
        setSearchResult(result);
        setIsModalOpen(true);
        setIsLoading(false);
    };

    return (
        <div className="p-4 md:p-8 flex-1 flex items-center justify-center">
            <div className="max-w-3xl w-full mx-auto text-center">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Ask Quantisa</h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Pergunte algo sobre seus projetos, custos de insumos ou métricas de negócio...
                </p>
                 <form onSubmit={handleSearch} className="relative mt-10 max-w-2xl mx-auto">
                    <div className="relative">
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ex: Qual o custo médio de cimento nos meus projetos aprovados?"
                            className="w-full p-4 pl-6 pr-12 border border-gray-200 dark:border-gray-700 rounded-full text-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                            {isLoading ? <Spinner className="w-5 h-5" /> : <SearchIcon className="w-6 h-6"/>}
                        </div>
                    </div>
                </form>
            </div>
            
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Resultado para: "${searchQuery}"`} size="xl">
                 {isLoading && <div className="flex justify-center"><Spinner /></div>}
                 {searchResult && (
                    <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-h-[60vh] overflow-y-auto">
                        <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: searchResult.text.replace(/\n/g, '<br />') }} />
                        {/* FIX: Check for groundingChunks existence before accessing its properties. */}
                        {searchResult.metadata && searchResult.metadata.groundingChunks && searchResult.metadata.groundingChunks.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-sm">Fontes:</h4>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                    {/* FIX: Check for chunk.web.uri before rendering the link and provide a fallback for the title. */}
                                    {searchResult.metadata.groundingChunks.map((chunk, index) => (
                                        chunk.web && chunk.web.uri && <li key={index}><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{chunk.web.title || chunk.web.uri}</a></li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};


"use client";

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkgfm from 'remark-gfm';
import { Button, PaperAirplaneIcon, Spinner, Modal } from './Shared';
import { answerQueryFromCompositions, type GeminiResponse } from '../services/geminiService';
import type { Composicao } from '../types';
import { FullCompositionDetailView } from './CompositionsView'; // Reutilizando a view detalhada

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    composicoes?: Composicao[];
    isLoading?: boolean;
}

const CompositionResultCard: React.FC<{ composition: Composicao, onViewDetails: () => void }> = ({ composition, onViewDetails }) => (
    <button onClick={onViewDetails} className="w-full text-left bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary transition-all duration-200 group">
        <p className="font-mono text-xs text-primary">{composition.codigo}</p>
        <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">{composition.titulo}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Custo Direto: <span className="font-mono">{composition.indicadores.custoDiretoTotal_porUnidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {composition.unidade}</span>
        </p>
    </button>
);


const ChatBubble: React.FC<{ message: ChatMessage, onViewComposition: (comp: Composicao) => void }> = ({ message, onViewComposition }) => {
    const isModel = message.role === 'model';

    if (message.isLoading) {
        return (
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white text-lg flex-shrink-0">H</div>
                <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 flex items-center">
                    <Spinner className="w-5 h-5 text-primary" />
                </div>
            </div>
        )
    }

    return (
        <div className={`flex items-start gap-3 ${!isModel && 'flex-row-reverse'}`}>
            {isModel && (
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white text-lg flex-shrink-0">H</div>
            )}
            <div className={`max-w-2xl rounded-lg p-4 ${isModel ? 'bg-gray-100 dark:bg-gray-800' : 'bg-primary text-white'}`}>
                <div className={`prose prose-sm max-w-none dark:prose-invert ${!isModel && 'prose-invert'}`}>
                    <ReactMarkdown remarkPlugins={[remarkgfm]}>{message.text}</ReactMarkdown>
                </div>
                {isModel && message.composicoes && message.composicoes.length > 0 && (
                     <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-2">
                        {message.composicoes.map(comp => (
                            <CompositionResultCard key={comp.id} composition={comp} onViewDetails={() => onViewComposition(comp)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const StartHereView = ({ composicoes, showToast }: { composicoes: Composicao[], showToast: (message: string, type?: 'success' | 'error') => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [compositionToView, setCompositionToView] = useState<Composicao | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: input };
        const thinkingMessage: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: '', isLoading: true };

        setMessages(prev => [...prev, userMessage, thinkingMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            const resultText = await answerQueryFromCompositions(currentInput, composicoes);
            const parsedResponse = JSON.parse(resultText) as GeminiResponse;
            
            const modelMessage: ChatMessage = { 
                id: thinkingMessage.id, 
                role: 'model', 
                text: '',
                isLoading: false
            };

            switch(parsedResponse.tipoResposta) {
                case 'lista_composicoes':
                    modelMessage.text = parsedResponse.textoIntroducao;
                    modelMessage.composicoes = composicoes.filter(c => parsedResponse.ids.includes(c.id));
                    break;
                case 'resposta_direta':
                case 'resposta_analitica':
                case 'nao_encontrado':
                    modelMessage.text = parsedResponse.texto;
                    break;
            }

            setMessages(prev => prev.map(msg => msg.id === thinkingMessage.id ? modelMessage : msg));

        } catch (error) {
            console.error("Error processing chat:", error);
            const errorMessage: ChatMessage = {
                id: thinkingMessage.id,
                role: 'model',
                text: 'Desculpe, ocorreu um erro ao processar sua pergunta. Verifique o formato da resposta da IA ou tente novamente.',
                isLoading: false
            };
            setMessages(prev => prev.map(msg => msg.id === thinkingMessage.id ? errorMessage : msg));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4 md:p-8">
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 pt-16">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Ask H-Quant</h1>
                        <p>Seu assistente de engenharia de custos.</p>
                        <p className="mt-4">Pergunte algo sobre sua base de dados para começar:</p>
                        <button onClick={() => setInput("Quais são as minhas composições de sóculo?")} className="font-mono text-sm mt-2 p-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg inline-block shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                           "Quais são as minhas composições de sóculo?"
                        </button>
                    </div>
                ) : (
                    messages.map(msg => <ChatBubble key={msg.id} message={msg} onViewComposition={setCompositionToView} />)
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="mt-6">
                <form onSubmit={handleSend}>
                    <div className="flex items-end gap-2 p-2 border rounded-lg shadow-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            placeholder="Digite sua pergunta..."
                            rows={1}
                            className="flex-1 p-0 bg-transparent border-none outline-none focus:ring-0 text-gray-900 dark:text-gray-200 resize-none max-h-36 overflow-y-auto"
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            className="!p-2 rounded-lg flex-shrink-0"
                            isLoading={isLoading}
                            disabled={!input.trim()}
                            aria-label="Enviar"
                        >
                            <PaperAirplaneIcon className="w-5 h-5" />
                        </Button>
                    </div>
                </form>
            </div>
             <Modal isOpen={!!compositionToView} onClose={() => setCompositionToView(null)} title="Detalhes da Composição" size="xl">
                {compositionToView && <FullCompositionDetailView composition={compositionToView} onCopyToClipboard={() => showToast("Funcionalidade de cópia não implementada.")} />}
            </Modal>
        </div>
    );
};
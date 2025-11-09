"use client";

import React from 'react';
import type { Project, Service, InternalQueryApproval, ApprovalStatus, RefinementSuggestion, InternalQuery, ValueEngineeringAnalysis } from '../types';
import { Button, TrashIcon, PlusIcon, ClipboardIcon, DownloadIcon, Spinner, ArrowLeftIcon, Modal } from './Shared';
import { KanbanStatus } from '../types';
import { getDetailedScope, getRefinementSuggestions, getValueEngineeringAnalysis, processQueryResponses, refineScopeFromEdits } from '../services/geminiService';

const STEPS = [
    { name: "Resumo", index: 0 },
    { name: "Escopo & Análise", index: 1 },
    { name: "Escopo Detalhado", index: 2 },
    { name: "Mapeamento de Composições", index: 3 },
    { name: "Validação de Composições", index: 4 },
    { name: "Validação & Custos", index: 5 },
    { name: "Planejamento", index: 6 },
    { name: "Precificação & Docs", index: 7 },
];


// --- Stepper Component ---
const Stepper = ({ currentStep, onStepClick, highestStepVisited }: { currentStep: number, onStepClick: (step: number) => void, highestStepVisited: number }) => {
    return (
        <nav aria-label="Progress">
            <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
                {STEPS.map((step, index) => {
                    const isActive = currentStep === index;
                    const isCompleted = index < currentStep;
                    const isAccessible = index <= highestStepVisited;
                    const isPending = index > currentStep && index <= highestStepVisited;

                    let borderColor = 'border-gray-200 dark:border-gray-700';
                    let textColor = 'text-gray-500 dark:text-gray-400';
                    let hoverColor = 'hover:border-gray-400';

                    if (isActive) {
                        borderColor = 'border-primary';
                        textColor = 'text-primary';
                    } else if (isCompleted) {
                        borderColor = 'border-green-600';
                        textColor = 'text-green-600';
                        hoverColor = 'hover:border-green-800';
                    } else if (isPending) {
                        borderColor = 'border-danger';
                        textColor = 'text-danger';
                        hoverColor = 'hover:border-red-700';
                    }

                    return (
                        <li key={step.name} className="md:flex-1">
                            <button
                                onClick={() => onStepClick(index)}
                                disabled={!isAccessible}
                                className={`group flex w-full flex-col border-l-4 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 disabled:cursor-not-allowed ${borderColor} ${hoverColor}`}
                            >
                                 <span className={`text-sm font-medium transition-colors ${textColor} ${isCompleted ? 'group-hover:text-green-800' : ''} ${isPending ? 'group-hover:text-red-700' : ''}`}>
                                    Etapa {index}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{step.name}</span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </nav>
    );
};


// --- Step 0: Summary ---
const Step0Summary = ({ project, onAdvance }: { project: Project, onAdvance: () => void }) => {
    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nome do Projeto</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{project.nome}</p>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Cliente</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{project.cliente}</p>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Data de Entrada</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{new Date(project.data_entrada).toLocaleDateString()}</p>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Data Limite para Envio</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{new Date(project.data_limite).toLocaleDateString()}</p>
                </div>
                 <div className="md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Briefing e Contexto</h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{project.briefing || "Nenhum briefing fornecido."}</p>
                </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 text-center mt-6">
                <Button onClick={onAdvance} size="lg">
                    Avançar para Análise →
                </Button>
            </div>
        </div>
    );
};

// --- Quadrant Component ---
const Quadrant = ({ title, children, className, actions }: { title: string, children?: React.ReactNode, className?: string, actions?: React.ReactNode }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col ${className}`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
            {actions && <div>{actions}</div>}
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
            {children}
        </div>
    </div>
);

const RenderMarkdownBold = ({ text }: { text: string }) => {
    // Looks for a title in the format **Title:** at the beginning of the string
    const match = text.match(/^\*\*(.*?)\*\*([\s\S]*)/);
    if (match) {
        const title = match[1];
        const description = match[2];
        return (
            <>
                <strong>{title}</strong>
                <span>{description}</span>
            </>
        );
    }
    return <>{text}</>;
};


// --- Step 1: Scope & Analysis ---
const Step1Analysis = ({ project, onComplete, showToast }: { project: Project, onComplete: (data: { services: Service[], clientAnswers: string }) => void, showToast: (message: string, type?: 'success' | 'error') => void }) => {
    const [services, setServices] = React.useState<Service[]>(project.services || []);
    const [clientAnswers, setClientAnswers] = React.useState(project.clientAnswers || '');

    const handleServiceChange = (id: string, field: keyof Service, value: string | number) => {
        setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const addService = () => {
        const newService: Service = {
            id: `new-${Date.now()}`,
            nome: '',
            quantidade: 0,
            unidade: ''
        };
        setServices(prev => [...prev, newService]);
    };
    
    const removeService = (id: string) => {
        setServices(prev => prev.filter(s => s.id !== id));
    };

    const handleCopyDoubts = () => {
        const doubtsText = project.doubts?.map((d, i) => `${i + 1}. ${d.question}`).join('\n') || '';
        navigator.clipboard.writeText(doubtsText);
        showToast("Dúvidas copiadas para a área de transferência!");
    };
    
    const handleDownloadCSV = () => {
        if (!services || services.length === 0) {
            showToast("Não há serviços para baixar.", 'error');
            return;
        }
        const headers = ['Item', 'Serviço', 'Quantidade', 'Unidade'];
        const csvContent = [
            headers.join(';'),
            ...services.map((s, i) => `${i + 1};"${s.nome.replace(/"/g, '""')}";${s.quantidade};"${s.unidade.replace(/"/g, '""')}"`)
        ].join('\n');

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `planilha-servicos-${project.nome.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Planilha de serviços baixada!");
    };


    const handleSubmit = () => {
        onComplete({ services, clientAnswers });
    }

    return (
        <div className="space-y-6">
            {/* --- TIER 1 --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Quadrant 
                    title="Planilha de Serviços"
                    actions={
                        <Button onClick={handleDownloadCSV} variant="ghost" size="sm">
                            <DownloadIcon className="w-4 h-4 mr-2" />
                            Baixar Planilha (CSV)
                        </Button>
                    }
                >
                    <div className="space-y-2">
                        <table className="w-full text-sm">
                            <thead className="text-left text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="pb-2 w-12">Item</th>
                                    <th className="pb-2">Serviço</th>
                                    <th className="pb-2 w-24">Qtd.</th>
                                    <th className="pb-2 w-24">Un.</th>
                                    <th className="pb-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.map((service, index) => (
                                    <tr key={service.id}>
                                        <td className="text-gray-500 dark:text-gray-400">{index + 1}</td>
                                        <td><input type="text" value={service.nome} onChange={e => handleServiceChange(service.id, 'nome', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200" /></td>
                                        <td><input type="number" value={service.quantidade} onChange={e => handleServiceChange(service.id, 'quantidade', parseFloat(e.target.value))} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200" /></td>
                                        <td><input type="text" value={service.unidade} onChange={e => handleServiceChange(service.id, 'unidade', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-gray-200" /></td>
                                        <td><button onClick={() => removeService(service.id)} className="text-gray-400 hover:text-danger"><TrashIcon className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Button onClick={addService} variant="secondary" size="sm"><PlusIcon className="w-4 h-4 mr-1" /> Adicionar Item</Button>
                    </div>
                </Quadrant>
                <Quadrant 
                    title="Dúvidas Técnicas da IA"
                    actions={
                        <Button onClick={handleCopyDoubts} variant="ghost" size="sm">
                            <ClipboardIcon className="w-4 h-4 mr-2" />
                            Copiar Dúvidas
                        </Button>
                    }
                >
                    {project.doubts && project.doubts.length > 0 ? (
                        <ul className="space-y-4 text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside">
                            {project.doubts.map(doubt => (
                                <li key={doubt.id}>{doubt.question}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma dúvida técnica gerada para este escopo.</p>
                    )}
                </Quadrant>
            </div>

            {/* --- TIER 2 --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: '300px' }}>
                 <Quadrant title="Respostas do Cliente" className="h-full">
                     <textarea 
                         value={clientAnswers}
                         onChange={e => setClientAnswers(e.target.value)}
                         className="w-full h-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 resize-none"
                         placeholder="Cole aqui as respostas do cliente para as dúvidas acima..."
                     />
                </Quadrant>
                <Quadrant title="Oportunidades de Engenharia de Valor">
                     {(project.valueEngineering && project.valueEngineering.length > 0) ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                            {project.valueEngineering.map((suggestion, i) => (
                                <li key={i}><RenderMarkdownBold text={suggestion} /></li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma oportunidade clara de engenharia de valor identificada.</p>
                    )}
                </Quadrant>
            </div>

            {/* --- TIER 3 --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Quadrant title="Principais Materiais Identificados">
                     {(project.keyMaterials && project.keyMaterials.length > 0) ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside columns-2">
                            {project.keyMaterials.map((material, i) => (
                                <li key={i}>{material}</li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum material chave identificado automaticamente.</p>
                    )}
                </Quadrant>
                <Quadrant title="Riscos Preliminares Identificados">
                     {(project.preliminaryRisks && project.preliminaryRisks.length > 0) ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                            {project.preliminaryRisks.map((risk, i) => (
                                 <li key={i}><RenderMarkdownBold text={risk} /></li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum risco preliminar identificado.</p>
                    )}
                </Quadrant>
            </div>


             <div className="p-4 border-t dark:border-gray-700 text-center mt-6">
                <Button onClick={handleSubmit} size="lg">
                    Avançar para Escopo Detalhado →
                </Button>
            </div>
        </div>
    );
}

// --- Verba Modal Component ---
const VerbaModal = ({ isOpen, items, onClose, onUpdate, onContinue }: {
    isOpen: boolean;
    items: Service[];
    onClose: () => void;
    onUpdate: (items: Service[], instruction: string) => void;
    onContinue: () => void;
}) => {
    const [editedItems, setEditedItems] = React.useState<Service[]>([]);
    const [instruction, setInstruction] = React.useState('');

    React.useEffect(() => {
        if (isOpen) {
            setEditedItems(JSON.parse(JSON.stringify(items))); // Deep copy
            setInstruction('');
        }
    }, [isOpen, items]);

    const handleItemChange = (id: string, field: 'quantidade' | 'unidade', value: string | number) => {
        setEditedItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Itens com Quantidade Indefinida">
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Os seguintes itens estão marcados como 'verba' e não possuem uma quantidade real. Por favor, revise e atualize as quantidades e unidades para garantir a precisão do orçamento.
                </p>
                <div className="border rounded-md max-h-64 overflow-y-auto dark:border-gray-600">
                    <table className="w-full text-sm">
                        <thead className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <th className="p-2">Serviço</th>
                                <th className="p-2 w-28">Quantidade</th>
                                <th className="p-2 w-28">Unidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editedItems.map(item => (
                                <tr key={item.id} className="border-t dark:border-gray-600">
                                    <td className="p-2 font-medium text-gray-900 dark:text-gray-200">{item.nome || "Serviço não identificado"}</td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={item.quantidade}
                                            onChange={e => handleItemChange(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-gray-900 p-1 rounded border border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-200"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            value={item.unidade}
                                            onChange={e => handleItemChange(item.id, 'unidade', e.target.value)}
                                            className="w-full bg-white dark:bg-gray-900 p-1 rounded border border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-200"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruções Adicionais (Opcional)</label>
                    <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        rows={2}
                        className="w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        placeholder="Ex: Calcule o entulho gerado nesta obra, e considere ele como um item novo."
                    />
                </div>
                 <p className="text-xs text-gray-500 dark:text-gray-400">
                    Estes dois itens indicados podem ficar como vb mesmo.
                </p>
                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="secondary" onClick={onContinue}>Continuar Mesmo Assim</Button>
                    <Button variant="primary" onClick={() => onUpdate(editedItems, instruction)}>Atualizar e Revisar</Button>
                </div>
            </div>
        </Modal>
    );
};


// --- Step 2: Detailed Scope ---
const Step2DetailedScope = ({ project, onAdvance, updateProject, showToast }: { project: Project, onAdvance: () => void, updateProject: (project: Project) => void, showToast: (message: string, type?: 'success' | 'error') => void }) => {
    const [isApplyingDefinitions, setIsApplyingDefinitions] = React.useState(false);
    const [areDefinitionsApplied, setAreDefinitionsApplied] = React.useState(!!project.valueEngineeringAnalysis);
    const [isRefinementApplied, setIsRefinementApplied] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editInstruction, setEditInstruction] = React.useState('');


    const handleServiceChange = (id: string, field: 'quantidade' | 'unidade', value: string | number) => {
        const updatedServices = (project.detailedServices || []).map(s => 
            s.id === id ? { ...s, [field]: value } : s
        );
        updateProject({ ...project, detailedServices: updatedServices });
    };
    
    const handleApprovalAction = (queryId: string, status: ApprovalStatus) => {
        const currentApproval = project.internalQueryApprovals?.[queryId] || { status: null, comment: '' };
        const newStatus = currentApproval.status === status ? null : status;
        const newApproval: InternalQueryApproval = { ...currentApproval, status: newStatus };
        const newApprovals = { ...project.internalQueryApprovals, [queryId]: newApproval };
        updateProject({ ...project, internalQueryApprovals: newApprovals });
    };

    const handleCommentChange = (queryId: string, comment: string) => {
        const currentApproval = project.internalQueryApprovals?.[queryId] || { status: null, comment: '' };
        const newApproval: InternalQueryApproval = { ...currentApproval, comment };
        const newApprovals = { ...project.internalQueryApprovals, [queryId]: newApproval };
        updateProject({ ...project, internalQueryApprovals: newApprovals });
    };

    const handleRefinementSelect = (doubtId: string, answer: string) => {
        const newSelections = { ...project.refinementSelections, [doubtId]: answer };
        updateProject({ ...project, refinementSelections: newSelections });
    };

    const handleCustomAnswerChange = (doubtId: string, text: string) => {
        const newCustomAnswers = { ...project.customRefinementAnswers, [doubtId]: text };
        updateProject({ ...project, customRefinementAnswers: newCustomAnswers });
    };

    const handleValueEngineeringSelect = (itemId: string, alternativeSolution: string) => {
        const newSelections = { ...project.valueEngineeringSelections, [itemId]: alternativeSolution };
        updateProject({ ...project, valueEngineeringSelections: newSelections });
    };

    const isOtherSelected = (doubtId: string) => project.refinementSelections?.[doubtId] === '__OTHER__';

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };
    
    const handleApplyDefinitions = async () => {
        setIsApplyingDefinitions(true);
        try {
            let intermediateProjectData: Partial<Project> = {};
            let refinementResult: { refinementSuggestions: RefinementSuggestion[] } = { refinementSuggestions: [] };
            let veResult: { valueEngineeringAnalysis: ValueEngineeringAnalysis[] } = { valueEngineeringAnalysis: [] };
    
            // ETAPA 1: Processar o feedback do usuário (Aprovações/Rejeições)
            if (isEditing) {
                const result = await refineScopeFromEdits(project.detailedServices || [], editInstruction);
                intermediateProjectData = { detailedServices: result.updatedServices };
                setIsEditing(false);
                setEditInstruction('');
                showToast("Escopo reanalisado com sucesso!");
            } else {
                const queryResponses = (project.internalQueries || []).map(q => ({
                    query: q,
                    status: project.internalQueryApprovals?.[q.id]?.status || null,
                    comment: project.internalQueryApprovals?.[q.id]?.comment || ''
                }));
                const processedData = await processQueryResponses(queryResponses, project.detailedServices || []);
                const updatedServices = [...(project.detailedServices || []), ...processedData.newServices];
                const updatedObservations = [...(project.observations || []), ...processedData.newObservations];
                const remainingQueries = (project.internalQueries || []).filter(
                    q => !project.internalQueryApprovals?.[q.id]?.status
                );
                intermediateProjectData = {
                    detailedServices: updatedServices,
                    observations: updatedObservations,
                    internalQueries: remainingQueries,
                };
                showToast("Definições aplicadas com sucesso!");
            }
    
            const servicesParaAnalise = intermediateProjectData.detailedServices || project.detailedServices || [];
            
            // ETAPA 2: Buscar a Engenharia de Valor (Chamada Crítica - Agora Protegida)
            try {
                console.log("--- DEBUG: Solicitando getValueEngineeringAnalysis ---");
                veResult = await getValueEngineeringAnalysis(servicesParaAnalise);
                console.log("--- DEBUG: getValueEngineeringAnalysis SUCESSO ---");
            } catch (veError) {
                console.error("Erro CRÍTICO ao buscar Engenharia de Valor:", veError);
                showToast("Erro ao gerar a Análise de Valor, mas outras definições foram salvas.", 'error');
            }
    
            // ETAPA 3: Buscar as Sugestões de Refinamento (Chamada Secundária - Agora Protegida)
            try {
                console.log("--- DEBUG: Solicitando getRefinementSuggestions ---");
                refinementResult = await getRefinementSuggestions(project.pendingDoubts || []); 
                console.log("--- DEBUG: getRefinementSuggestions SUCESSO ---");
            } catch (refError) {
                console.error("Erro CRÍTICO ao buscar Sugestões de Refinamento:", refError);
                showToast("Erro ao buscar refinamento de dúvidas. Verifique o console (F12).", 'error');
            }
    
            // ETAPA 4: Consolidar e Salvar o Estado UMA VEZ
            const finalProjectState = {
                ...project,
                ...intermediateProjectData,
                refinementSuggestions: refinementResult.refinementSuggestions,
                valueEngineeringAnalysis: veResult.valueEngineeringAnalysis,
                refinementSelections: {},
                customRefinementAnswers: {},
                valueEngineeringSelections: {},
            };
    
            updateProject(finalProjectState);
            setAreDefinitionsApplied(true);
            setIsRefinementApplied(false);
    
        } catch (e) {
            console.error("Erro fatal ao processar definições:", e);
            showToast(e instanceof Error ? `Erro: ${e.message}` : "Ocorreu um erro desconhecido.", 'error');
        } finally {
            setIsApplyingDefinitions(false);
        }
    };

    const handleApplyRefinements = () => {
        setIsRefinementApplied(true);
        showToast("Seleções de refinamento salvas!");
    }

    const handleEnterEditMode = () => {
        setAreDefinitionsApplied(false);
        setIsEditing(true);
    };


    return (
        <div className="space-y-6">
            <Quadrant title="Validação do Escopo Detalhado">
                 <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Abaixo está a versão detalhada do escopo, gerada pela IA com base nas respostas do cliente. Revise as descrições de cada serviço para garantir que estão corretas e completas.
                    </p>
                    {(project.detailedServices || []).length > 0 ? (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="p-3 w-12 font-medium">Item</th>
                                        <th className="p-3 font-medium">Serviço</th>
                                        <th className="p-3 w-24 text-center font-medium">Qtd.</th>
                                        <th className="p-3 w-24 text-center font-medium">Un.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(project.detailedServices || []).map((service, index) => (
                                        <React.Fragment key={service.id}>
                                            <tr className="border-t border-gray-200 dark:border-gray-700">
                                                <td className="p-3 text-gray-500 dark:text-gray-400 align-top">{index + 1}</td>
                                                <td className="p-3 text-gray-500 dark:text-gray-400">
                                                    {service.nome}
                                                    {service.description && (
                                                         <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap mt-2 leading-normal text-sm">
                                                            {service.description}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center text-gray-600 dark:text-gray-300 align-top">
                                                    {isEditing ? (
                                                        <input type="number" value={service.quantidade} onChange={e => handleServiceChange(service.id, 'quantidade', parseFloat(e.target.value))} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-center" />
                                                    ) : service.quantidade}
                                                </td>
                                                <td className="p-3 text-center text-gray-600 dark:text-gray-300 align-top">
                                                     {isEditing ? (
                                                        <input type="text" value={service.unidade} onChange={e => handleServiceChange(service.id, 'unidade', e.target.value)} className="w-full bg-transparent p-1 rounded focus:bg-gray-100 dark:focus:bg-gray-700 outline-none text-center" />
                                                    ) : service.unidade}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Nenhum serviço detalhado foi gerado. Volte para a etapa anterior e forneça as respostas do cliente.
                        </p>
                    )}
                </div>
            </Quadrant>
            
            {isEditing && (
                <Quadrant title="Instruções Adicionais para Reanálise">
                    <textarea
                        value={editInstruction}
                        onChange={(e) => setEditInstruction(e.target.value)}
                        rows={3}
                        className="w-full p-2 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                        placeholder="Ex: Adicionar serviço de retirada de entulho para a demolição..."
                    />
                </Quadrant>
            )}

            {project.observations && project.observations.length > 0 && (
                <Quadrant title="Observações Gerais do Projeto">
                     <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                        {project.observations.map((obs, i) => (
                            <li key={i}>{obs}</li>
                        ))}
                    </ul>
                </Quadrant>
            )}

            {project.internalQueries && project.internalQueries.length > 0 && !areDefinitionsApplied && !isEditing && (
                <Quadrant title="Consultas Internas da IA (Premissas Adotadas)">
                     <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">A IA encontrou respostas vagas e adotou as seguintes premissas. Revise, confirme ou corrija.</p>
                        <ul className="space-y-3 text-sm">
                            {project.internalQueries.map(query => (
                                <li key={query.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
                                    <div className="flex justify-between items-start gap-4">
                                        <p className="flex-1 dark:text-yellow-200">{query.query}</p>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            <Button 
                                                size="sm" 
                                                variant={project.internalQueryApprovals?.[query.id]?.status === 'approved' ? 'primary' : 'secondary'}
                                                onClick={() => handleApprovalAction(query.id, 'approved')}
                                            >
                                                Aprovar
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant={project.internalQueryApprovals?.[query.id]?.status === 'rejected' ? 'danger' : 'secondary'}
                                                onClick={() => handleApprovalAction(query.id, 'rejected')}
                                            >
                                                Reprovar
                                            </Button>
                                        </div>
                                    </div>
                                    <textarea
                                        rows={1}
                                        placeholder="Adicionar comentário ou correção (opcional)..."
                                        onBlur={(e) => handleCommentChange(query.id, e.target.value)}
                                        defaultValue={project.internalQueryApprovals?.[query.id]?.comment || ''}
                                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 p-2"
                                    />
                                </li>
                            ))}
                        </ul>
                     </div>
                </Quadrant>
            )}


            {isApplyingDefinitions && (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Spinner className="w-8 h-8 mb-4" />
                    <h3 className="text-lg font-semibold dark:text-white">Processando Definições...</h3>
                    <p className="text-gray-600 dark:text-gray-400">A IA está interpretando suas aprovações e correções.</p>
                </div>
            )}
            
            {areDefinitionsApplied && project.valueEngineeringAnalysis === undefined && (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <Spinner className="w-8 h-8 mb-4" />
                    <h3 className="text-lg font-semibold dark:text-white">Analisando Dúvidas e Oportunidades...</h3>
                    <p className="text-gray-600 dark:text-gray-400">A IA está gerando novas sugestões com base no escopo atualizado.</p>
                </div>
            )}
            
            {areDefinitionsApplied && project.refinementSuggestions && project.refinementSuggestions.length > 0 && (
                 <Quadrant title="Refinamento de Dúvidas Pendentes">
                    <div className="space-y-6">
                        {project.refinementSuggestions.map(suggestion => (
                            <div key={suggestion.doubtId}>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-200">{suggestion.question}</label>
                                <fieldset className="mt-2">
                                    <legend className="sr-only">Opções para {suggestion.question}</legend>
                                    <div className="space-y-2">
                                        {(suggestion.suggestedAnswers || []).map(opt => (
                                            <div key={opt.answer} className="flex items-center">
                                                <input
                                                    id={`${suggestion.doubtId}-${opt.answer}`}
                                                    name={suggestion.doubtId}
                                                    type="radio"
                                                    onChange={() => handleRefinementSelect(suggestion.doubtId, opt.answer)}
                                                    checked={project.refinementSelections?.[suggestion.doubtId] === opt.answer}
                                                    className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                                />
                                                <label htmlFor={`${suggestion.doubtId}-${opt.answer}`} className="ml-3 block text-sm text-gray-700 dark:text-gray-300">
                                                    {opt.answer} <span className="text-sm text-amber-700 dark:text-amber-500">{opt.tag}</span>
                                                </label>
                                            </div>
                                        ))}
                                        <div className="flex items-start">
                                            <div className="flex items-center h-5">
                                                <input
                                                    id={`${suggestion.doubtId}-other`}
                                                    name={suggestion.doubtId}
                                                    type="radio"
                                                    onChange={() => handleRefinementSelect(suggestion.doubtId, '__OTHER__')}
                                                    checked={isOtherSelected(suggestion.doubtId)}
                                                    className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                                />
                                            </div>
                                            <div className="ml-3 text-sm w-full">
                                                 <label htmlFor={`${suggestion.doubtId}-other`} className="text-gray-700 dark:text-gray-300">
                                                    Outra:
                                                </label>
                                                <textarea
                                                    rows={1}
                                                    disabled={!isOtherSelected(suggestion.doubtId)}
                                                    value={project.customRefinementAnswers?.[suggestion.doubtId] || ''}
                                                    onChange={(e) => handleCustomAnswerChange(suggestion.doubtId, e.target.value)}
                                                    onInput={handleTextareaInput}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 disabled:opacity-50 p-2 overflow-hidden resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                        ))}
                    </div>
                </Quadrant>
            )}

            {areDefinitionsApplied && project.valueEngineeringAnalysis && (
                <Quadrant title="Análise de Engenharia de Valor">
                    <div className="space-y-8">
                         {(project.valueEngineeringAnalysis || []).map(analysis => (
                            analysis && analysis.itemId && (
                                <div key={analysis.itemId}>
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Item de Alto Impacto: <span className="text-primary">{analysis.itemName}</span></h4>
                                    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-left text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 uppercase">
                                                <tr>
                                                    <th className="p-3 font-medium w-48">Solução</th>
                                                    <th className="p-3 font-medium w-32 text-center">Custo Relativo</th>
                                                    <th className="p-3 font-medium w-32 text-center">Impacto no Prazo</th>
                                                    <th className="p-3 font-medium min-w-64">Vantagens (Prós)</th>
                                                    <th className="p-3 font-medium min-w-64">Desvantagens (Contras)</th>
                                                    <th className="p-3 font-medium min-w-64">Recomendação Técnica</th>
                                                    <th className="p-3 w-32 text-center font-medium">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                {(analysis.options || []).map(opt => (
                                                    <tr key={opt.solution}>
                                                        <td className="p-3 font-medium text-gray-900 dark:text-gray-200 whitespace-pre-line">{opt.solution}</td>
                                                        <td className="p-3 whitespace-pre-line text-center text-gray-700 dark:text-gray-300">{opt.relativeCost || 'N/A'}</td>
                                                        <td className="p-3 whitespace-pre-line text-center text-gray-700 dark:text-gray-300">{opt.deadlineImpact || 'N/A'}</td>
                                                        <td className="p-3">
                                                            <ul className="list-disc list-inside space-y-1 text-green-700 dark:text-green-400">
                                                                {(opt.pros || []).map(pro => <li key={pro}>{pro}</li>)}
                                                            </ul>
                                                        </td>
                                                        <td className="p-3">
                                                            <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-400">
                                                                {(opt.cons || []).map(con => <li key={con}>{con}</li>)}
                                                            </ul>
                                                        </td>
                                                        <td className="p-3 font-bold text-gray-800 dark:text-gray-200">
                                                            {(opt.recommendation || 'N/A').replace(/\*\*/g, '')}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Button 
                                                                size="sm" 
                                                                variant={project.valueEngineeringSelections?.[analysis.itemId] === opt.solution ? 'primary' : 'secondary'}
                                                                onClick={() => handleValueEngineeringSelect(analysis.itemId, opt.solution)}
                                                            >
                                                                {project.valueEngineeringSelections?.[analysis.itemId] === opt.solution ? '✓ Selecionado' : 'Selecionar'}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                         ))}
                         {(!project.valueEngineeringAnalysis || project.valueEngineeringAnalysis.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma oportunidade clara de engenharia de valor identificada para os itens de maior impacto.</p>}
                    </div>
                </Quadrant>
            )}


            <div className="p-4 border-t dark:border-gray-700 flex flex-col items-center gap-4 mt-6">
                 {(!areDefinitionsApplied && !isEditing) ? (
                     <Button 
                        onClick={handleApplyDefinitions} 
                        size="lg" 
                        variant='primary'
                        isLoading={isApplyingDefinitions}
                    >
                        Aplicar Definições ao Escopo
                    </Button>
                 ) : null}
                 {isEditing ? (
                      <Button 
                        onClick={handleApplyDefinitions} 
                        size="lg" 
                        variant='primary'
                        isLoading={isApplyingDefinitions}
                    >
                        Aplicar Novas Definições e Reanalisar
                    </Button>
                 ) : null}
                 {areDefinitionsApplied ? (
                    <div className="flex flex-col items-center gap-4">
                        <Button 
                           onClick={handleApplyRefinements} 
                           size="lg" 
                           variant='primary'
                           disabled={isRefinementApplied}
                       >
                           {isRefinementApplied ? '✓ Refinamentos Salvos' : 'Salvar Refinamentos e Finalizar Escopo'}
                       </Button>
                       <Button 
                           onClick={onAdvance} 
                           size="lg" 
                           disabled={!isRefinementApplied}
                       >
                           Avançar para Mapeamento →
                       </Button>
                        <Button 
                           onClick={handleEnterEditMode}
                           size="md" 
                           variant='secondary'
                           className="mt-2"
                       >
                           Alterar Definições Iniciais
                       </Button>
                   </div>
                ) : null}
            </div>
        </div>
    );
};


// --- Step 3: Composition Mapping (Placeholder) ---
const Step3Mapping = ({ project, onComplete }: { project: Project, onComplete: () => void }) => {
    return (
        <div className="space-y-6">
            <Quadrant title="Mapeamento de Composições">
                 <p className="text-gray-600 dark:text-gray-300">
                     <b>Propósito da Etapa:</b> Aqui, para cada item do escopo detalhado, a IA irá sugerir composições de custo existentes em seu banco de dados. Você poderá selecionar a mais adequada ou marcar para criar uma nova.
                    <br /><br />
                    (Funcionalidade a ser implementada)
                 </p>
            </Quadrant>
            <div className="p-4 border-t dark:border-gray-700 text-center mt-6">
                <Button onClick={onComplete} size="lg">
                    Avançar para Validação de Composições →
                </Button>
            </div>
        </div>
    );
};

// --- Step 4: Composition Validation (Placeholder) ---
const Step4Validation = ({ project, onComplete }: { project: Project, onComplete: () => void }) => {
    return (
        <div className="space-y-6">
            <Quadrant title="Validação de Composições">
                 <p className="text-gray-600 dark:text-gray-300">
                    <b>Propósito da Etapa:</b> Após o mapeamento, a IA irá criar as composições marcadas como "novas".
                    <br /><br />
                    Nesta tela, você verá:
                    <br />1. As novas composições para sua aprovação.
                    <br />2. A lista consolidada de todas as composições (novas e existentes) para uma revisão final.
                    <br /><br />
                    (Funcionalidade a ser implementada)
                 </p>
            </Quadrant>
            <div className="p-4 border-t dark:border-gray-700 text-center mt-6">
                <Button onClick={onComplete} size="lg">
                    Avançar para Validação de Custos →
                </Button>
            </div>
        </div>
    );
};


// --- Workspace View Component ---
interface WorkspaceViewProps {
    project: Project;
    onBack: () => void;
    updateProject: (project: Project) => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
    initialStep?: number;
}
export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ project, onBack, updateProject, showToast, initialStep = 0 }) => {
    const [activeStep, setActiveStep] = React.useState(initialStep);
    const [highestStepVisited, setHighestStepVisited] = React.useState(initialStep);
    const [isVerbaModalOpen, setIsVerbaModalOpen] = React.useState(false);
    const [verbaItemsToEdit, setVerbaItemsToEdit] = React.useState<Service[]>([]);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [loadingMessage, setLoadingMessage] = React.useState('');


    React.useEffect(() => {
        setActiveStep(initialStep);
        setHighestStepVisited(prev => Math.max(prev, initialStep));
    }, [project.id, initialStep]);
    
    const handleStepCompletion = async <T,>(currentStepIndex: number, data: T) => {
        let updatedData: Partial<Project> = {};
        const nextStep = currentStepIndex + 1;
        
        if (currentStepIndex === 1) { 
            const { services, clientAnswers } = data as { services: Service[], clientAnswers: string };
             if (!clientAnswers.trim()) {
                showToast("Por favor, preencha as respostas do cliente para avançar.", 'error');
                return;
            }
            
            setLoadingMessage('Gerando escopo detalhado com a IA...');
            setIsGenerating(true);
            try {
                const result = await getDetailedScope(services, project.doubts || [], clientAnswers);
                updatedData = { 
                    services, 
                    clientAnswers,
                    detailedServices: result.detailedServices,
                    pendingDoubts: result.pendingDoubts,
                    internalQueries: result.internalQueries,
                    refinementSuggestions: undefined,
                    valueEngineeringAnalysis: undefined,
                    refinementSelections: {},
                    customRefinementAnswers: {},
                    valueEngineeringSelections: {},
                    internalQueryApprovals: {},
                    observations: [],
                };
                if (project.status === KanbanStatus.Backlog) {
                    updatedData.status = KanbanStatus.InProgress;
                }
                
                 updateProject({ ...project, ...updatedData });
                 setHighestStepVisited(prev => Math.max(prev, nextStep));
                 setActiveStep(nextStep);


            } catch (e) {
                console.error(e);
                showToast(e instanceof Error ? e.message : "Ocorreu um erro ao gerar o escopo detalhado.", 'error');
            } finally {
                setIsGenerating(false);
            }
            return;
        }
        
        if (nextStep < STEPS.length) {
           setHighestStepVisited(prev => Math.max(prev, nextStep));
           setActiveStep(nextStep);
        }
        
        if (Object.keys(updatedData).length > 0) {
            updateProject({ ...project, ...updatedData });
        }
        
        if (currentStepIndex === STEPS.length - 1) {
            updateProject({ ...project, status: KanbanStatus.ReadyToSend });
        }
    };
    
    const handleStepClick = (stepIndex: number) => {
        if (stepIndex <= highestStepVisited) {
            setActiveStep(stepIndex);
            if(stepIndex > highestStepVisited) {
                setHighestStepVisited(stepIndex);
            }
        }
    }

    const handleAdvanceToMapping = () => {
        const problematicItems = project.detailedServices?.filter(s => 
            s.unidade.toLowerCase().trim() === 'vb' || s.unidade.toLowerCase().trim() === 'verba'
        ) || [];

        if (problematicItems.length > 0) {
            setVerbaItemsToEdit(problematicItems);
            setIsVerbaModalOpen(true);
        } else {
            handleStepCompletion(2, {});
        }
    };

    const handleVerbaUpdate = async (updatedItems: Service[], instruction: string) => {
        setIsVerbaModalOpen(false); // Close modal BEFORE processing
        const newServices = (project.detailedServices || []).map(s => {
            const updatedItem = updatedItems.find(u => u.id === s.id);
            return updatedItem ? updatedItem : s;
        });

        if (instruction.trim()) {
            setLoadingMessage('Reanalisando o escopo com base nas suas edições...');
            setIsGenerating(true);
             try {
                const result = await refineScopeFromEdits(newServices, instruction);
                updateProject({ ...project, detailedServices: result.updatedServices });
                showToast("Itens e instruções aplicados com sucesso!");
            } catch (e) {
                showToast("Erro ao processar instrução adicional.", 'error');
            } finally {
                setIsGenerating(false);
            }
        } else {
             updateProject({...project, detailedServices: newServices});
             showToast("Itens atualizados. Por favor, clique em 'Avançar' novamente.");
        }
    };

    const renderContent = () => {
        switch (activeStep) {
            case 0: return <Step0Summary project={project} onAdvance={() => handleStepCompletion(0, {})} />;
            case 1: 
                return <Step1Analysis project={project} onComplete={(data) => handleStepCompletion(1, data)} showToast={showToast} />;
            case 2:
                return <Step2DetailedScope project={project} onAdvance={handleAdvanceToMapping} updateProject={updateProject} showToast={showToast} />;
            case 3:
                return <Step3Mapping project={project} onComplete={() => handleStepCompletion(3, {})} />;
            case 4:
                return <Step4Validation project={project} onComplete={() => handleStepCompletion(4, {})} />;
            case 5: return <p className="dark:text-gray-300 p-6">Etapa 5: Validação de Custos e Recálculo Final.</p>;
            case 6: return <p className="dark:text-gray-300 p-6">Etapa 6: Consolidação, Planejamento e Contingência de Prazo.</p>;
            case 7: return <div className="p-6"><p className="dark:text-gray-300">Etapa 7: Precificação, Contingência de Custo e Geração de Documentos.</p><Button className="mt-4" onClick={() => handleStepCompletion(7, {})}>Finalizar Orçamento</Button></div>;
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 relative">
             {isGenerating && (
                <div className="fixed inset-0 bg-light-bg/80 dark:bg-gray-900/80 flex flex-col items-center justify-center z-50">
                    <Spinner className="w-12 h-12" />
                    <p className="text-gray-800 dark:text-white mt-4 text-lg">{loadingMessage}</p>
                </div>
            )}
             <div className="mb-6 flex justify-between items-center">
                <div>
                    <Button onClick={onBack} variant="secondary">
                        <ArrowLeftIcon className="mr-2 w-5 h-5" />
                        Voltar
                    </Button>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{project.nome}</h2>
                <div/>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
                <Stepper currentStep={activeStep} onStepClick={handleStepClick} highestStepVisited={highestStepVisited} />
            </div>
            <div>
                {renderContent()}
            </div>
             <VerbaModal 
                isOpen={isVerbaModalOpen}
                items={verbaItemsToEdit}
                onClose={() => setIsVerbaModalOpen(false)}
                onUpdate={handleVerbaUpdate}
                onContinue={() => {
                    setIsVerbaModalOpen(false);
                    handleStepCompletion(2, {});
                }}
            />
        </div>
    );
};
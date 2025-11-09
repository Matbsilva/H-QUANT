"use client";

import React from 'react';
import type { Project, ReturnHistoryItem } from '../types';
import { Button, ArrowLeftIcon, Badge } from './Shared';
import { Priority } from '../types';

const DetailItem = ({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) => (
    <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</h3>
        {children ? <div className="mt-1">{children}</div> : <p className="mt-1 text-gray-900 dark:text-white">{value || 'N/A'}</p>}
    </div>
);

export const ProjectDetailView = ({ project, onBack, onDelete, onGoToWorkspace, onAddReturn }: { project: Project; onBack: () => void; onDelete: () => void; onGoToWorkspace: () => void; onAddReturn: (projectId: string) => void; }) => {
    
    const priorityMap = {
        [Priority.High]: { text: 'Alta', color: 'red' as 'red' },
        [Priority.Medium]: { text: 'Média', color: 'yellow' as 'yellow' },
        [Priority.Low]: { text: 'Baixa', color: 'green' as 'green' },
    };

    return (
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <Button onClick={onBack} variant="secondary">
                    <ArrowLeftIcon className="mr-2 w-4 h-4" /> Voltar ao Dashboard
                </Button>
                <Button onClick={onDelete} variant="danger">
                    Apagar Card
                </Button>
            </div>

            <div className="max-w-4xl mx-auto">
                {/* Project Summary Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.nome}</h1>
                            <p className="text-md text-gray-600 dark:text-gray-400">{project.cliente}</p>
                        </div>
                        <Badge color={priorityMap[project.prioridade].color}>
                            Prioridade {priorityMap[project.prioridade].text}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 my-6 border-t border-b dark:border-gray-700 py-6">
                        <DetailItem label="Status" value={project.status} />
                        <DetailItem label="Data de Entrada" value={new Date(project.data_entrada).toLocaleDateString()} />
                        <DetailItem label="Data Limite p/ Envio" value={new Date(project.data_limite).toLocaleDateString()} />
                        <DetailItem label="Data de Envio" value={project.data_envio ? new Date(project.data_envio).toLocaleDateString() : 'Não enviado'} />
                    </div>

                    <div className="mb-6">
                        <DetailItem label="Resumo / Briefing">
                            <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.briefing || project.resumo_tecnico || 'Nenhum briefing fornecido.'}</p>
                        </DetailItem>
                    </div>

                    <div className="text-center">
                        <Button onClick={onGoToWorkspace} size="lg" className="w-full md:w-auto">
                           Ver/Editar Especificações Integrais (Workspace)
                        </Button>
                    </div>
                </div>

                {/* Return History Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold dark:text-white">Histórico de Retornos</h2>
                        <Button onClick={() => onAddReturn(project.id)} variant="secondary">
                            + Adicionar Retorno
                        </Button>
                    </div>
                    <div>
                        {project.returns && project.returns.length > 0 ? (
                            <ul className="space-y-4">
                                {project.returns.map((item: ReturnHistoryItem) => (
                                    <li key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                        <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{new Date(item.date).toLocaleString()}</p>
                                        <p className="text-gray-600 dark:text-gray-300">{item.notes}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum retorno registrado ainda.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
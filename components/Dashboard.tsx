"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Project } from '../types';
import { Priority, KanbanStatus } from '../types';
import { KANBAN_COLUMNS } from '../constants';
import { CalendarIcon, ClockIcon, TrashIcon, Badge, InboxIcon } from './Shared';

// --- Project Card Component ---
interface ProjectCardProps {
    project: Project;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, projectId: string) => void;
    onDelete: () => void;
}
const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDragStart, onDelete }) => {
    const priorityMap = {
        [Priority.High]: { text: 'Alta Prioridade', color: 'red' as 'red', border: 'bg-red-500' },
        [Priority.Medium]: { text: 'Média Prioridade', color: 'yellow' as 'yellow', border: 'bg-yellow-500' },
        [Priority.Low]: { text: 'Baixa Prioridade', color: 'green' as 'green', border: 'bg-green-500' },
    };

    // State to hold the calculated days, calculated only on the client-side to prevent hydration errors.
    const [days, setDays] = useState<number | null>(null);

    useEffect(() => {
        if ((project.status === KanbanStatus.Sent || project.status === KanbanStatus.Waiting) && project.data_envio) {
            const sentDate = new Date(project.data_envio);
            const diff = new Date().getTime() - sentDate.getTime();
            const calculatedDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            setDays(calculatedDays);
        } else {
            setDays(null);
        }
    }, [project.status, project.data_envio]);

    const priorityInfo = priorityMap[project.prioridade];

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, project.id)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4 cursor-grab active:cursor-grabbing border border-gray-200 dark:border-gray-700 group transition-all duration-300 hover:shadow-lg hover:scale-105 overflow-hidden"
        >
            <div className={`h-1.5 ${priorityInfo.border}`}></div>
            <div className="p-4">
                <div className="flex justify-between items-start">
                     <h4 className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">{project.nome}</h4>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-danger"
                        aria-label="Delete project"
                    >
                         <TrashIcon className="w-4 h-4" />
                     </button>
                </div>
                <p className="text-sm text-neutral dark:text-gray-400 mb-3">{project.cliente}</p>
               
                <div className="flex flex-col space-y-2 mt-2 text-xs text-neutral dark:text-gray-400">
                     <div className="flex justify-between items-center">
                        <Badge color={priorityInfo.color}>{priorityInfo.text}</Badge>
                        {days !== null && (
                         <div className={`flex items-center space-x-1 ${days >= 7 && project.status === KanbanStatus.Waiting ? 'text-danger font-bold' : ''}`}>
                                <ClockIcon className="w-4 h-4" />
                                <span>{days} dias</span>
                            </div>
                        )}
                     </div>
                     <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2">
                        <div className="flex items-center space-x-1" title="Data de Entrada">
                            <InboxIcon className="w-4 h-4" />
                            <span>{new Date(project.data_entrada).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1" title="Data Limite para Envio">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{new Date(project.data_limite).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Kanban Column Component ---
interface KanbanColumnProps {
    status: KanbanStatus;
    projects: Project[];
    onDragStart: (e: React.DragEvent<HTMLDivElement>, projectId: string) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: KanbanStatus) => void;
    onCardClick: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
}
const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, projects, onDragStart, onDrop, onCardClick, onDeleteProject }) => {
    const [isOver, setIsOver] = useState(false);

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
                onDrop(e, status);
                setIsOver(false);
            }}
            className={`bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 w-72 md:w-80 lg:w-96 flex-shrink-0 transition-colors duration-300 ${isOver ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">{status}</h3>
                <span className="text-sm text-neutral dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-1">{projects.length}</span>
            </div>
            <div className="h-full">
                {projects.map(project => (
                    <div key={project.id} onClick={() => onCardClick(project)}>
                      <ProjectCard project={project} onDragStart={onDragStart} onDelete={() => onDeleteProject(project.id)} />
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Dashboard View Component ---
interface DashboardViewProps {
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    onSelectProject: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({ projects, setProjects, onSelectProject, onDeleteProject }) => {

    // Effect for auto-transition from 'Sent' to 'Waiting'
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            let hasChanged = false;
            const updatedProjects = projects.map(p => {
                if (p.status === KanbanStatus.Sent && p.data_envio) {
                    const sentDate = new Date(p.data_envio);
                    const diffDays = (now.getTime() - sentDate.getTime()) / (1000 * 3600 * 24);
                    if (diffDays >= 7) {
                        hasChanged = true;
                        return { ...p, status: KanbanStatus.Waiting };
                    }
                }
                return p;
            });

            if (hasChanged) {
                setProjects(updatedProjects);
            }
        }, 1000 * 60 * 60); // Check every hour

        return () => clearInterval(interval);
    }, [projects, setProjects]);

    // State to hold overdue projects, calculated only on the client-side to prevent hydration errors.
    const [overdueProjects, setOverdueProjects] = useState<Project[]>([]);

    useEffect(() => {
        const now = new Date();
        const filtered = projects.filter(p => {
            if (p.status === KanbanStatus.Waiting && p.data_envio) {
                const sentDate = new Date(p.data_envio);
                const diffDays = (now.getTime() - sentDate.getTime()) / (1000 * 3600 * 24);
                return diffDays >= 10;
            }
            return false;
        });
        setOverdueProjects(filtered);
    }, [projects]);


    const onDragStart = (e: React.DragEvent<HTMLDivElement>, projectId: string) => {
        e.dataTransfer.setData("projectId", projectId);
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: KanbanStatus) => {
        const projectId = e.dataTransfer.getData("projectId");
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const updatedProject = { ...project, status: newStatus };
        
        // If moved to 'Sent', set the sent date.
        // If moved from 'Waiting' back to 'Sent', reset the sent date.
        if (newStatus === KanbanStatus.Sent) {
            updatedProject.data_envio = new Date();
        }

        setProjects(prevProjects =>
            prevProjects.map(p =>
                p.id === projectId ? updatedProject : p
            )
        );
    };

    const projectsByStatus = useMemo(() => {
        return KANBAN_COLUMNS.reduce((acc, status) => {
            acc[status] = projects.filter(p => p.status === status);
            return acc;
        }, {} as Record<KanbanStatus, Project[]>);
    }, [projects]);


    return (
        <div className="h-full flex flex-col bg-light-bg dark:bg-gray-900">
            {overdueProjects.length > 0 && (
                <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 px-4 md:px-8 py-2 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-700/50 text-center" role="alert">
                    <p>
                       <span className="font-bold">Atenção:</span> Existem {overdueProjects.length} orçamento{overdueProjects.length > 1 ? 's' : ''} aguardando retorno há 10 dias ou mais.
                    </p>
                </div>
            )}
            <div className="p-4 md:px-8 flex-1 overflow-x-auto">
                <div className="flex space-x-4 h-full">
                    {KANBAN_COLUMNS.map(status => (
                        <KanbanColumn
                            key={status}
                            status={status}
                            projects={projectsByStatus[status] || []}
                            onDragStart={onDragStart}
                            onDrop={onDrop}
                            onCardClick={onSelectProject}
                            onDeleteProject={onDeleteProject}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
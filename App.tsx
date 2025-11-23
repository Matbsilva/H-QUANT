
"use client";

import React, { useState, useEffect } from 'react';
import { CompositionsView } from './components/CompositionsView';
import { Button, MoonIcon, SunIcon } from './components/Shared';
import type { Composicao } from './types';
import { compositionService } from './services/compositionService';
import { StartHereView } from './components/StartHereView';

// --- TOAST NOTIFICATION ---
type ToastType = 'success' | 'error';
interface ToastProps {
    toast: { message: string; type: ToastType };
    onDismiss: () => void;
}
const Toast = ({ toast, onDismiss }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 3000); // Dismiss after 3 seconds

        return () => clearTimeout(timer);
    }, [onDismiss]);

    const typeClasses = {
        success: 'bg-green-500',
        error: 'bg-danger',
    };

    return (
        <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${typeClasses[toast.type]} text-white py-2 px-4 rounded-lg shadow-lg z-[9999] animate-fade-in-down`}>
            {toast.message}
        </div>
    );
};


// --- THEME TOGGLE ---
const ThemeToggle = () => {
    // Initialize state to null to ensure server and client render the same initial UI
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

    // On client-side mount, determine the theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    // When theme state changes, update the document and localStorage
    useEffect(() => {
        if (theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Render a placeholder or nothing until the theme is determined on the client
    if (theme === null) {
        return <div className="w-10 h-10 rounded-full" />; // Placeholder to prevent layout shift
    }

    return (
        <Button onClick={toggleTheme} variant="ghost" className="rounded-full !p-2">
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </Button>
    );
};


const App: React.FC = () => {
    const [composicoes, setComposicoes] = useState<Composicao[]>([]);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activeView, setActiveView] = useState<'start' | 'compositions'>('start');

    useEffect(() => {
        const loadComposicoes = async () => {
            try {
                const data = await compositionService.fetchAll();
                setComposicoes(data);
            } catch (error) {
                console.error("Erro ao carregar composições:", error);
                showToast("Erro ao carregar dados do servidor.", "error");
            }
        };
        loadComposicoes();
    }, []);

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type });
    };

    const NavButton = ({ view, label }: { view: 'start' | 'compositions', label: string }) => (
        <button
            onClick={() => setActiveView(view)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeView === view ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-gray-50 dark:bg-gray-900/50 min-h-screen flex flex-col">
            {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
            <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between h-16 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="H-Quant Logo" className="w-8 h-8 rounded-md object-cover" />
                        <h1 className="hidden sm:block text-2xl font-bold text-primary dark:text-indigo-400">H-Quant</h1>
                    </div>
                    <nav className="flex items-center gap-2">
                        <NavButton view="start" label="Comece por Aqui" />
                        <NavButton view="compositions" label="Composições" />
                    </nav>
                </div>
                <ThemeToggle />
            </header>
            <main className="flex-1 overflow-y-auto">
                {activeView === 'start' && <StartHereView composicoes={composicoes} showToast={showToast} />}
                {activeView === 'compositions' && <CompositionsView composicoes={composicoes} setComposicoes={setComposicoes} showToast={showToast} />}
            </main>
        </div>
    );
};

export default App;
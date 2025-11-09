import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./App.tsx",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ao redefinir 'gray' aqui, todas as classes de utilitário como 'bg-gray-800'
        // agora usarão a paleta 'slate', que tem melhor contraste e resolve
        // os problemas de "texto branco sobre cinza claro" no modo escuro.
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e2937',
          900: '#0f172a',
          950: '#020617',
        },
        
        primary: '#4f46e5', // Indigo-600
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        'quantisa-blue': '#1e3a8a', // Dark blue for section titles
        
        // Redefinimos neutral e light-bg para garantir que usem nosso novo cinza baseado em slate.
        neutral: '#64748b', // slate-500
        'light-bg': '#f8fafc', // slate-50
      },
    },
  },
  plugins: [
    typography,
  ],
};
export default config;
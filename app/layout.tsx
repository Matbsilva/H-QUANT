import type { Metadata } from "next";
import React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantisa - Cost Engineering AI",
  description: "An intelligent cost engineering system that uses AI to streamline project budgeting, from scope analysis to professional document generation. Features include a Kanban dashboard, a guided 5-step quoting process, and a self-learning data master.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
            dangerouslySetInnerHTML={{
              __html: `
                // Support dark mode
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              `,
            }}
          />
      </head>
      <body className="bg-light-bg dark:bg-gray-900">{children}</body>
    </html>
  );
}

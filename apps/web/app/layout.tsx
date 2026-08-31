import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '../components/header';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Code Review Assistant',
  description: 'AI-powered code review that evaluates changes against your repository\'s architecture.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-white">
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

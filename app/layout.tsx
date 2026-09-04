import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { AuthScreen } from '@/components/auth-screen';
import { getAuthenticatedUser } from './db-auth';
import './globals.css';

const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KCA Financeiro',
  description: 'Controle de notas fiscais, impostos, gastos e valor líquido da sua empresa.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getAuthenticatedUser();
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} antialiased`}>{user ? children : <AuthScreen />}</body>
    </html>
  );
}

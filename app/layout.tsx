import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { ArrowRight, BarChart3, Building2, LockKeyhole, ReceiptText } from 'lucide-react';
import { chatGPTSignInPath, getChatGPTUser } from './chatgpt-auth';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KCA Financeiro',
  description: 'Controle de notas fiscais, impostos, gastos e valor líquido da KCA Soluções em TI.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getChatGPTUser();
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} antialiased`}>
        {user ? children : <LoginScreen />}
      </body>
    </html>
  );
}

function LoginScreen() {
  return (
    <main className="grid min-h-screen bg-[#07152f] text-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative flex flex-col justify-between overflow-hidden p-7 sm:p-12 lg:p-16">
        <div className="absolute -right-32 top-24 size-80 rounded-full border border-white/10" aria-hidden="true" />
        <div className="absolute -right-12 top-44 size-80 rounded-full border border-white/5" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#2f6bff] text-sm font-black shadow-[0_10px_30px_rgb(47_107_255/35%)]">KCA</div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8babff]">Gestão financeira</p><p className="font-bold">KCA Financeiro</p></div>
        </div>
        <div className="relative z-10 my-16 max-w-2xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#9ee87b]">Seu financeiro, só seu</p>
          <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.05em] sm:text-5xl lg:text-6xl">Notas, impostos e gastos em um único lugar.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">Cada empresa mantém seus dados separados e protegidos. Entre para acompanhar o valor líquido recebido e a evolução mensal.</p>
        </div>
        <div className="relative z-10 grid gap-3 sm:grid-cols-3">
          <LoginFeature icon={<ReceiptText />} text="Notas detalhadas" />
          <LoginFeature icon={<BarChart3 />} text="Comparação mensal" />
          <LoginFeature icon={<LockKeyhole />} text="Dados protegidos" />
        </div>
      </section>
      <section className="flex items-center justify-center bg-[#f5f7fb] p-6 text-slate-950 sm:p-12">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_28px_80px_rgb(15_23_42/12%)] sm:p-9">
          <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-blue-50 text-[#2f6bff]"><Building2 /></div>
          <p className="text-sm font-bold uppercase tracking-[0.13em] text-[#2f6bff]">Acesso seguro</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">Entre na sua conta</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Use sua conta do ChatGPT. No primeiro acesso, você poderá cadastrar os dados da sua empresa.</p>
          <a href={chatGPTSignInPath('/')} target="_top" className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#2f6bff] px-5 text-sm font-bold text-white transition hover:bg-[#2457d6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
            Entrar com ChatGPT <ArrowRight className="size-4" />
          </a>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><LockKeyhole className="size-3.5" /> Seus lançamentos não são compartilhados com outras empresas.</div>
        </div>
      </section>
    </main>
  );
}

function LoginFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200"><span className="text-[#8babff]">{icon}</span>{text}</div>;
}

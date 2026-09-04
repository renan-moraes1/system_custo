'use client';

import { SyntheticEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, Building2, KeyRound, LoaderCircle, LockKeyhole, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthMode = 'login' | 'setup';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const password = formValue(form, 'password');
    if (mode === 'setup' && password !== formValue(form, 'confirmPassword')) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    const payload = mode === 'login'
      ? { action: 'login', email: formValue(form, 'email'), password }
      : { action: 'setupAdmin', setupToken: formValue(form, 'setupToken'), name: formValue(form, 'name'), companyName: formValue(form, 'companyName'), cnpj: formValue(form, 'cnpj'), email: formValue(form, 'email'), password };

    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível continuar.');
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível continuar.');
      setLoading(false);
    }
  }

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
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#9ee87b]">Um ambiente para cada empresa</p>
          <h1 className="text-4xl font-black leading-[1.08] tracking-[-0.05em] sm:text-5xl lg:text-6xl">Notas, impostos e gastos em um único lugar.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">Crie sua conta com e-mail e senha. Cada empresa mantém seus lançamentos, parâmetros e relatórios separados.</p>
        </div>
        <div className="relative z-10 grid gap-3 sm:grid-cols-3">
          <AuthFeature icon={<ReceiptText />} text="Notas detalhadas" />
          <AuthFeature icon={<BarChart3 />} text="Comparação mensal" />
          <AuthFeature icon={<LockKeyhole />} text="Dados protegidos" />
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f5f7fb] p-6 text-slate-950 sm:p-12">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_28px_80px_rgb(15_23_42/12%)] sm:p-9">
          <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-blue-50 text-[#2f6bff]"><Building2 /></div>
          {mode === 'login' ? (
            <>
              <AuthHeading title="Acesse sua empresa" text="Entre com o e-mail e a senha cadastrados." />
              <form onSubmit={submit} className="mt-6 space-y-4">
                <AuthField label="E-mail"><Input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" className="h-12" /></AuthField>
                <AuthField label="Senha"><Input name="password" type="password" autoComplete="current-password" required placeholder="Sua senha" className="h-12" /></AuthField>
                <AuthError message={error} />
                <Button type="submit" disabled={loading} className="h-12 w-full bg-[#2f6bff] text-base hover:bg-[#2457d6]">{loading ? <LoaderCircle className="animate-spin" /> : <>Entrar <ArrowRight /></>}</Button>
              </form>
              <button type="button" onClick={() => { setMode('setup'); setError(''); }} className="mx-auto mt-5 flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-[#2f6bff]"><KeyRound className="size-3.5" />Primeiro acesso do administrador</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setMode('login'); setError(''); }} className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#2f6bff]"><ArrowLeft className="size-4" />Voltar ao login</button>
              <AuthHeading title="Ativar administrador" text="Use o código de ativação fornecido na implantação." />
              <form onSubmit={submit} className="mt-6 space-y-4">
                <AuthField label="Código de ativação"><Input name="setupToken" type="password" autoComplete="off" required placeholder="Código de primeiro acesso" className="h-12" /></AuthField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField label="Seu nome"><Input name="name" autoComplete="name" required placeholder="Nome completo" className="h-12" /></AuthField>
                  <AuthField label="Empresa"><Input name="companyName" autoComplete="organization" required placeholder="Nome da empresa" className="h-12" /></AuthField>
                </div>
                <AuthField label="CNPJ (opcional)"><Input name="cnpj" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className="h-12" /></AuthField>
                <AuthField label="E-mail"><Input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" className="h-12" /></AuthField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField label="Senha"><Input name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="Mínimo 10 caracteres" className="h-12" /></AuthField>
                  <AuthField label="Confirmar senha"><Input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required placeholder="Repita a senha" className="h-12" /></AuthField>
                </div>
                <p className="text-xs leading-5 text-slate-400">Use pelo menos 10 caracteres, incluindo uma letra e um número.</p>
                <AuthError message={error} />
                <Button type="submit" disabled={loading} className="h-12 w-full bg-[#2f6bff] text-base hover:bg-[#2457d6]">{loading ? <LoaderCircle className="animate-spin" /> : <><LockKeyhole />Ativar conta principal</>}</Button>
              </form>
            </>
          )}
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400"><LockKeyhole className="size-3.5" /> Sessão protegida e senha armazenada de forma criptográfica.</div>
        </div>
      </section>
    </main>
  );
}

function formValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function AuthHeading({ title, text }: { title: string; text: string }) {
  return <div><p className="text-sm font-bold uppercase tracking-[0.13em] text-[#2f6bff]">Acesso seguro</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>;
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>{children}</label>;
}

function AuthError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</p> : null;
}

function AuthFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200"><span className="text-[#8babff]">{icon}</span>{text}</div>;
}

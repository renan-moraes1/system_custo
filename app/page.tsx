'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Calculator,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  ReceiptText,
  Save,
  Settings2,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Invoice = {
  id: string;
  noteNumber: string;
  clientName: string;
  issueDate: string;
  grossCents: number;
  status: 'recebida' | 'pendente';
};

type Expense = {
  id: string;
  description: string;
  category: string;
  expenseDate: string;
  amountCents: number;
};

type Settings = {
  iss: number;
  pis: number;
  cofins: number;
  irpj: number;
  csll: number;
  inssSocio: number;
  inssPatronal: number;
  proLaboreCents: number;
  contadorCents: number;
  planoSaudeCents: number;
  emissaoNotaCents: number;
};

type Company = { id: string; name: string; legalName: string | null; cnpj: string | null };
type AppUser = { displayName: string; email: string };
type FinanceData = { user: AppUser | null; company: Company | null; invoices: Invoice[]; expenses: Expense[]; settings: Settings };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const defaultSettings: Settings = {
  iss: 200,
  pis: 65,
  cofins: 300,
  irpj: 480,
  csll: 288,
  inssSocio: 1100,
  inssPatronal: 2000,
  proLaboreCents: 162100,
  contadorCents: 46000,
  planoSaudeCents: 21000,
  emissaoNotaCents: 7000,
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const today = new Date().toISOString().slice(0, 10);

function calculate(gross: number, settings: Settings) {
  const byRate = (basisPoints: number) => gross * (basisPoints / 10000);
  const iss = byRate(settings.iss);
  const pis = byRate(settings.pis);
  const cofins = byRate(settings.cofins);
  const irpj = byRate(settings.irpj);
  const csll = byRate(settings.csll);
  const proLabore = settings.proLaboreCents / 100;
  const inssPatronal = proLabore * (settings.inssPatronal / 10000);
  const inssSocio = proLabore * (settings.inssSocio / 10000);
  const proLaboreNet = proLabore - inssSocio;
  const taxes = iss + pis + cofins + irpj + csll + inssPatronal;
  const fixed = proLabore + settings.contadorCents / 100 + settings.planoSaudeCents / 100 + settings.emissaoNotaCents / 100;
  const profit = gross - taxes - fixed;
  const totalReceived = profit + proLaboreNet;

  return {
    iss, pis, cofins, irpj, csll, inssPatronal, inssSocio, proLabore,
    proLaboreNet, taxes, fixed, profit, totalReceived,
    margin: gross > 0 ? (profit / gross) * 100 : 0,
  };
}

async function sendRecord(payload: Record<string, unknown>) {
  const response = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as { id?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar.');
  return data;
}

export default function Home() {
  const [gross, setGross] = useState(23500);
  const [data, setData] = useState<FinanceData>({ user: null, company: null, invoices: [], expenses: [], settings: defaultSettings });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/records', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setData(await response.json() as FinanceData);
    } catch {
      setMessage('Os dados salvos não puderam ser carregados agora. A calculadora continua disponível.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!data.company) return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'create_kca_invoice',
        title: 'Lançar nota fiscal da KCA',
        description: 'Salva uma nota fiscal com número, cliente, data, valor bruto em reais e situação.',
        inputSchema: {
          type: 'object',
          properties: {
            noteNumber: { type: 'string' }, clientName: { type: 'string' },
            issueDate: { type: 'string', format: 'date' }, grossValue: { type: 'number', exclusiveMinimum: 0 },
            status: { type: 'string', enum: ['recebida', 'pendente'] },
          },
          required: ['noteNumber', 'clientName', 'issueDate', 'grossValue', 'status'], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const grossValue = Number(input.grossValue);
          if (!Number.isFinite(grossValue) || grossValue <= 0) throw new Error('O valor bruto precisa ser positivo.');
          const result = await sendRecord({ type: 'invoice', ...input, grossCents: Math.round(grossValue * 100) });
          await loadData();
          return { id: result.id, status: 'salva' };
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: 'create_kca_expense',
        title: 'Lançar gasto da KCA',
        description: 'Salva um gasto extra com descrição, categoria, data e valor em reais.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' }, category: { type: 'string' },
            expenseDate: { type: 'string', format: 'date' }, amount: { type: 'number', exclusiveMinimum: 0 },
          },
          required: ['description', 'category', 'expenseDate', 'amount'], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const amount = Number(input.amount);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do gasto precisa ser positivo.');
          const result = await sendRecord({ type: 'expense', ...input, amountCents: Math.round(amount * 100) });
          await loadData();
          return { id: result.id, status: 'salvo' };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadData, data.company]);

  const result = useMemo(() => calculate(gross || 0, data.settings), [gross, data.settings]);
  const totals = useMemo(() => {
    const received = data.invoices.filter((invoice) => invoice.status === 'recebida');
    const grossTotal = received.reduce((sum, invoice) => sum + invoice.grossCents / 100, 0);
    const companyProfit = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, data.settings).profit, 0);
    const expenses = data.expenses.reduce((sum, expense) => sum + expense.amountCents / 100, 0);
    return { grossTotal, companyProfit, expenses, adjusted: companyProfit - expenses };
  }, [data]);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 4500);
  };

  const remove = async (type: 'invoice' | 'expense', id: string) => {
    const response = await fetch(`/api/records?type=${type}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return notify('Não foi possível excluir o lançamento.');
    await loadData();
    notify('Lançamento excluído.');
  };

  if (loading) return <LoadingScreen />;

  if (!data.company) {
    return <CompanyOnboarding user={data.user} onSaved={async () => { await loadData(); notify('Empresa cadastrada com sucesso.'); }} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-slate-200 bg-[#07152f] text-white">
        <div className="mx-auto flex min-h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#2f6bff] text-sm font-black tracking-tight shadow-[0_10px_30px_rgb(47_107_255/35%)]">KCA</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8babff]">{data.company.name}</p>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">Controle financeiro</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block"><p className="text-sm font-semibold text-white">{data.user?.displayName}</p><p className="text-xs text-slate-400">{data.user?.email}</p></div>
            <a href="/signout-with-chatgpt?return_to=%2F" target="_top" aria-label="Sair da conta" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></a>
          </div>
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="block">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-[1500px] overflow-x-auto px-5 sm:px-8">
            <TabsList variant="line" className="h-14 gap-5">
              <TabsTrigger value="dashboard" className="px-2"><LayoutDashboard />Visão geral</TabsTrigger>
              <TabsTrigger value="monthly" className="px-2"><CalendarRange />Histórico mensal</TabsTrigger>
              <TabsTrigger value="invoices" className="px-2"><FileText />Notas fiscais</TabsTrigger>
              <TabsTrigger value="expenses" className="px-2"><WalletCards />Gastos</TabsTrigger>
              <TabsTrigger value="settings" className="px-2"><Settings2 />Parâmetros</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {message && (
          <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-[#07152f] px-4 py-3 text-sm font-medium text-white shadow-2xl">
            {message}
          </div>
        )}

        <TabsContent value="dashboard"><Dashboard gross={gross} setGross={setGross} result={result} totals={totals} settings={data.settings} invoices={data.invoices} /></TabsContent>
        <TabsContent value="monthly"><MonthlyHistory invoices={data.invoices} expenses={data.expenses} settings={data.settings} /></TabsContent>
        <TabsContent value="invoices"><InvoicesPanel invoices={data.invoices} settings={data.settings} onSaved={async () => { await loadData(); notify('Nota fiscal salva com sucesso.'); }} onDelete={(id) => remove('invoice', id)} /></TabsContent>
        <TabsContent value="expenses"><ExpensesPanel expenses={data.expenses} onSaved={async () => { await loadData(); notify('Gasto salvo com sucesso.'); }} onDelete={(id) => remove('expense', id)} /></TabsContent>
        <TabsContent value="settings"><SettingsPanel settings={data.settings} onSaved={async () => { await loadData(); notify('Parâmetros atualizados.'); }} /></TabsContent>
      </Tabs>
    </main>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#07152f] text-white"><div className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#2f6bff]"><LoaderCircle className="animate-spin" /></div><p className="mt-4 text-sm font-semibold text-slate-300">Preparando seu ambiente financeiro...</p></div></main>;
}

function CompanyOnboarding({ user, onSaved }: { user: AppUser | null; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await sendRecord({ type: 'company', name: form.get('name'), legalName: form.get('legalName'), cnpj: form.get('cnpj') });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cadastrar a empresa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-[#07152f] text-white"><div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#2f6bff] text-sm font-black">KCA</div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8babff]">KCA Financeiro</p><p className="font-bold">Configuração inicial</p></div></div><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{user?.displayName}</p><p className="text-xs text-slate-400">{user?.email}</p></div></div></header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center sm:px-8 sm:py-16">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#2f6bff]">Primeiro acesso</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Cadastre sua empresa</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-500">Esse cadastro cria um ambiente exclusivo. Notas, gastos, parâmetros e relatórios ficarão separados dos dados de todos os outros usuários.</p>
          <div className="mt-8 space-y-4">
            <OnboardingStep number="01" title="Identifique a empresa" text="Informe o nome usado no dia a dia e, opcionalmente, os dados fiscais." />
            <OnboardingStep number="02" title="Ajuste os parâmetros" text="Depois do cadastro, revise impostos, pró-labore, contador e Unimed." />
            <OnboardingStep number="03" title="Comece a lançar" text="Cadastre notas e gastos para formar seu histórico mensal." />
          </div>
        </section>
        <form onSubmit={submit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgb(15_23_42/10%)] sm:p-9">
          <div className="mb-7 flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-[#2f6bff]"><Building2 /></div><div><h2 className="text-xl font-extrabold">Dados da empresa</h2><p className="mt-1 text-sm text-slate-500">Você poderá usar o sistema logo após salvar.</p></div></div>
          <div className="space-y-5">
            <Field label="Nome da empresa"><Input name="name" required maxLength={80} placeholder="Ex.: KCA Soluções em TI" className="h-12" /></Field>
            <Field label="Razão social (opcional)"><Input name="legalName" maxLength={120} placeholder="Nome registrado da empresa" className="h-12" /></Field>
            <Field label="CNPJ (opcional)"><Input name="cnpj" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className="h-12" /></Field>
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" disabled={saving} className="mt-7 h-12 w-full bg-[#2f6bff] text-base hover:bg-[#2457d6]">{saving ? <LoaderCircle className="animate-spin" /> : <Building2 />}{saving ? 'Criando seu ambiente' : 'Cadastrar empresa e continuar'}</Button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-400">Ao continuar, esta empresa ficará vinculada exclusivamente à sua conta.</p>
        </form>
      </div>
    </main>
  );
}

function OnboardingStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#07152f] text-xs font-black text-[#9ee87b]">{number}</span><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div></div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-[#2f6bff]">{eyebrow}</p>
      <h2 className="text-2xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function Dashboard({ gross, setGross, result, totals, settings, invoices }: {
  gross: number; setGross: (value: number) => void; result: ReturnType<typeof calculate>;
  totals: { grossTotal: number; companyProfit: number; expenses: number; adjusted: number };
  settings: Settings; invoices: Invoice[];
}) {
  const breakdown = [
    ['ISS', result.iss], ['PIS', result.pis], ['COFINS', result.cofins], ['IRPJ', result.irpj],
    ['CSLL', result.csll], ['INSS patronal', result.inssPatronal], ['Pró-labore bruto', result.proLabore],
    ['Contador', settings.contadorCents / 100], ['Unimed', settings.planoSaudeCents / 100],
    ['Emissão da nota', settings.emissaoNotaCents / 100],
  ] as const;
  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Simulador" title="Quanto fica no seu bolso?" description="Digite o valor bruto da nota. O cálculo considera os tributos, o INSS patronal, o pró-labore e os custos fixos configurados." />
      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-[22px] bg-[#07152f] p-6 text-white shadow-[0_22px_60px_rgb(15_23_42/14%)]">
          <div className="mb-8 flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8babff]">Nova simulação</p><h3 className="mt-1 text-xl font-bold">Valor da nota</h3></div>
            <div className="grid size-11 place-items-center rounded-2xl bg-white/10"><Calculator /></div>
          </div>
          <label htmlFor="gross" className="mb-2 block text-sm font-medium text-slate-300">Valor bruto recebido</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">R$</span>
            <Input id="gross" type="number" min="0" step="100" value={gross} onChange={(event) => setGross(Number(event.target.value))} className="h-16 rounded-2xl border-white/15 bg-white/8 pl-14 pr-4 text-2xl font-extrabold text-white focus-visible:border-[#6f95ff] focus-visible:ring-[#2f6bff]/30" />
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/6 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300"><span>Total que você recebe</span><ArrowUpRight className="size-4 text-[#9ee87b]" /></div>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#b8f58f]">{currency.format(result.totalReceived)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Lucro líquido + pró-labore líquido ({currency.format(result.proLaboreNet)}).</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Impostos" value={currency.format(result.taxes)} note="Tributos + INSS patronal" icon={<ArrowDownRight />} tone="blue" />
          <Metric label="Custos fixos" value={currency.format(result.fixed)} note="Inclui o valor da Unimed" icon={<Building2 />} tone="orange" />
          <Metric label="Lucro líquido" value={currency.format(result.profit)} note="Resultado da empresa" icon={<ArrowUpRight />} tone="green" />
          <Metric label="Margem líquida" value={`${result.margin.toFixed(2).replace('.', ',')}%`} note="Sobre o valor bruto" icon={<Calculator />} tone="violet" />
          <div className="rounded-[22px] border border-slate-200 bg-white p-6 sm:col-span-2 xl:col-span-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div><p className="text-sm font-semibold text-slate-500">Composição da nota</p><h3 className="mt-1 text-lg font-bold text-slate-950">Destino do valor bruto</h3></div>
              <p className="text-sm font-semibold text-slate-700">{currency.format(gross || 0)}</p>
            </div>
            <div className="mt-7 flex h-4 overflow-hidden rounded-full bg-slate-100" aria-label="Distribuição do valor da nota">
              <span className="bg-[#2f6bff]" style={{ width: `${gross ? Math.max(0, result.taxes / gross * 100) : 0}%` }} />
              <span className="bg-[#ff9d42]" style={{ width: `${gross ? Math.max(0, result.fixed / gross * 100) : 0}%` }} />
              <span className="bg-[#19a974]" style={{ width: `${Math.max(0, result.margin)}%` }} />
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <Legend color="#2f6bff" label="Impostos" value={result.taxes} />
              <Legend color="#ff9d42" label="Custos" value={result.fixed} />
              <Legend color="#19a974" label="Lucro" value={result.profit} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500">Memória do cálculo</p><h3 className="mt-1 text-lg font-bold text-slate-950">Descontos desta nota</h3></div><ReceiptText className="text-[#2f6bff]" /></div>
          <div className="grid gap-x-8 sm:grid-cols-2">
            {breakdown.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 py-3 text-sm"><span className="text-slate-500">{label}</span><strong className="text-slate-900">{currency.format(value)}</strong></div>)}
          </div>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">Resultado dos lançamentos</p><h3 className="mt-1 text-lg font-bold text-slate-950">Acumulado salvo</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SummaryLine label="Notas recebidas" value={totals.grossTotal} />
            <SummaryLine label="Lucro das notas" value={totals.companyProfit} />
            <SummaryLine label="Gastos extras" value={-totals.expenses} negative />
            <div className="mt-1 flex items-center justify-between rounded-2xl bg-[#eaf8e2] px-4 py-4"><span className="font-bold text-emerald-800">Resultado ajustado</span><strong className="text-xl text-emerald-900">{currency.format(totals.adjusted)}</strong></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">Considere como extras apenas os gastos que não estão nos parâmetros fixos, evitando contagem duplicada.</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{invoices.length} {invoices.length === 1 ? 'nota salva' : 'notas salvas'}</p>
        </div>
      </section>
    </div>
  );
}

function MonthlyHistory({ invoices, expenses, settings }: { invoices: Invoice[]; expenses: Expense[]; settings: Settings }) {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach((invoice) => months.add(invoice.issueDate.slice(0, 7)));
    expenses.forEach((expense) => months.add(expense.expenseDate.slice(0, 7)));
    if (!months.size) months.add(today.slice(0, 7));
    return [...months].sort().reverse();
  }, [invoices, expenses]);
  const [month, setMonth] = useState(availableMonths[0]);

  useEffect(() => {
    if (!availableMonths.includes(month)) setMonth(availableMonths[0]);
  }, [availableMonths, month]);

  const previousMonth = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
    return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
  }, [month]);

  const monthLabel = (value: string) => {
    const [year, monthNumber] = value.split('-').map(Number);
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const summarize = (targetMonth: string) => {
    const notes = invoices.filter((invoice) => invoice.issueDate.startsWith(targetMonth));
    const received = notes.filter((invoice) => invoice.status === 'recebida');
    const monthExpenses = expenses.filter((expense) => expense.expenseDate.startsWith(targetMonth));
    const gross = received.reduce((sum, invoice) => sum + invoice.grossCents / 100, 0);
    const taxes = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).taxes, 0);
    const fixed = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).fixed, 0);
    const profit = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).profit, 0);
    const receivedTotal = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).totalReceived, 0);
    const extraExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amountCents / 100, 0);
    return { notes, monthExpenses, gross, taxes, fixed, profit, receivedTotal, extraExpenses, adjusted: profit - extraExpenses };
  };

  const current = summarize(month);
  const previous = summarize(previousMonth);

  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeading eyebrow="Histórico mensal" title="Fechamento e evolução" description="Consulte o resultado consolidado do mês, abra o cálculo de cada nota e compare o desempenho com o período anterior." />
        <Field label="Mês de referência">
          <Select value={month} onValueChange={(value) => setMonth(String(value))}>
            <SelectTrigger className="h-11 min-w-56 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{availableMonths.map((item) => <SelectItem key={item} value={item}>{monthLabel(item)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ComparisonCard label="Valor bruto recebido" current={current.gross} previous={previous.gross} />
        <ComparisonCard label="Impostos" current={current.taxes} previous={previous.taxes} inverse />
        <ComparisonCard label="Lucro líquido" current={current.profit} previous={previous.profit} />
        <ComparisonCard label="Resultado após extras" current={current.adjusted} previous={previous.adjusted} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <p className="text-sm font-semibold text-slate-500">Detalhamento das notas</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{monthLabel(month)}</h3>
          </div>
          {current.notes.length ? (
            <Table>
              <TableHeader><TableRow><TableHead className="pl-5">Nota</TableHead><TableHead>Cliente</TableHead><TableHead>Situação</TableHead><TableHead>Bruto</TableHead><TableHead>Impostos</TableHead><TableHead>Custos fixos</TableHead><TableHead>Lucro</TableHead><TableHead className="pr-5">Total recebido</TableHead></TableRow></TableHeader>
              <TableBody>{current.notes.map((invoice) => { const detail = calculate(invoice.grossCents / 100, settings); return <TableRow key={invoice.id}><TableCell className="pl-5 font-bold text-slate-900">{invoice.noteNumber}</TableCell><TableCell>{invoice.clientName}</TableCell><TableCell><StatusBadge status={invoice.status} /></TableCell><TableCell>{currency.format(invoice.grossCents / 100)}</TableCell><TableCell className="text-blue-700">{currency.format(detail.taxes)}</TableCell><TableCell className="text-orange-700">{currency.format(detail.fixed)}</TableCell><TableCell className="font-bold text-emerald-700">{currency.format(detail.profit)}</TableCell><TableCell className="pr-5 font-bold text-slate-900">{currency.format(detail.totalReceived)}</TableCell></TableRow>; })}</TableBody>
            </Table>
          ) : <EmptyState icon={<CalendarRange />} title="Nenhuma nota neste mês" text="Escolha outro período ou registre uma nota fiscal para iniciar o histórico." />}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[22px] bg-[#07152f] p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8babff]">Fechamento do mês</p>
            <div className="mt-5 space-y-3">
              <DarkSummaryLine label="Valor bruto" value={current.gross} />
              <DarkSummaryLine label="Impostos" value={-current.taxes} />
              <DarkSummaryLine label="Custos fixos" value={-current.fixed} />
              <DarkSummaryLine label="Gastos extras" value={-current.extraExpenses} />
              <div className="border-t border-white/10 pt-4"><p className="text-sm text-slate-400">Resultado ajustado</p><strong className="mt-1 block text-3xl tracking-[-0.04em] text-[#b8f58f]">{currency.format(current.adjusted)}</strong></div>
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">Gastos extras do mês</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{currency.format(current.extraExpenses)}</h3>
            <div className="mt-4 space-y-3">
              {current.monthExpenses.slice(0, 5).map((expense) => <div key={expense.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><div><p className="font-semibold text-slate-800">{expense.description}</p><p className="mt-0.5 text-xs text-slate-400">{expense.category}</p></div><strong className="text-orange-700">{currency.format(expense.amountCents / 100)}</strong></div>)}
              {!current.monthExpenses.length && <p className="text-sm leading-6 text-slate-500">Nenhum gasto extra lançado neste período.</p>}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ComparisonCard({ label, current, previous, inverse }: { label: string; current: number; previous: number; inverse?: boolean }) {
  const change = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;
  const positive = inverse ? change <= 0 : change >= 0;
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/4%)]">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-slate-950">{currency.format(current)}</p>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Mês anterior: {currency.format(previous)}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(change).toFixed(1).replace('.', ',')}%</span>
      </div>
    </article>
  );
}

function DarkSummaryLine({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-slate-400">{label}</span><strong className={value < 0 ? 'text-slate-200' : 'text-white'}>{currency.format(value)}</strong></div>;
}

function InvoicesPanel({ invoices, settings, onSaved, onDelete }: { invoices: Invoice[]; settings: Settings; onSaved: () => Promise<void>; onDelete: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'recebida' | 'pendente'>('recebida');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await sendRecord({ type: 'invoice', noteNumber: form.get('noteNumber'), clientName: form.get('clientName'), issueDate: form.get('issueDate'), grossCents: Math.round(Number(form.get('grossValue')) * 100), status });
      event.currentTarget.reset(); setStatus('recebida'); await onSaved();
    } finally { setSaving(false); }
  }
  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Notas fiscais" title="Registre cada recebimento" description="Guarde o número, o cliente e o valor bruto. O sistema aplica os parâmetros atuais para mostrar o líquido estimado." />
      <form onSubmit={submit} className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/4%)] md:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] xl:items-end">
        <Field label="Número da nota"><Input name="noteNumber" required placeholder="Ex.: 2026-001" className="h-11" /></Field>
        <Field label="Cliente"><Input name="clientName" required placeholder="Nome do cliente" className="h-11" /></Field>
        <Field label="Data de emissão"><Input name="issueDate" type="date" required defaultValue={today} className="h-11" /></Field>
        <Field label="Valor bruto"><Input name="grossValue" type="number" min="0.01" step="0.01" required placeholder="0,00" className="h-11" /></Field>
        <Field label="Situação">
          <Select value={status} onValueChange={(value) => setStatus(value as 'recebida' | 'pendente')}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recebida">Recebida</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent></Select>
        </Field>
        <Button type="submit" disabled={saving} className="h-11 bg-[#2f6bff] px-4 hover:bg-[#2457d6]"><Plus />{saving ? 'Salvando' : 'Salvar nota'}</Button>
      </form>
      <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5"><h3 className="text-lg font-bold text-slate-950">Histórico de notas</h3><p className="mt-1 text-sm text-slate-500">{invoices.length} lançamentos registrados</p></div>
        {invoices.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Nota</TableHead><TableHead>Cliente</TableHead><TableHead>Emissão</TableHead><TableHead>Situação</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido estimado</TableHead><TableHead className="pr-5 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{invoices.map((invoice) => { const net = calculate(invoice.grossCents / 100, settings).totalReceived; return <TableRow key={invoice.id}><TableCell className="pl-5 font-bold text-slate-900">{invoice.noteNumber}</TableCell><TableCell>{invoice.clientName}</TableCell><TableCell>{shortDate.format(new Date(`${invoice.issueDate}T00:00:00Z`))}</TableCell><TableCell><StatusBadge status={invoice.status} /></TableCell><TableCell>{currency.format(invoice.grossCents / 100)}</TableCell><TableCell className="font-bold text-emerald-700">{currency.format(net)}</TableCell><TableCell className="pr-5 text-right"><DeleteButton onDelete={() => onDelete(invoice.id)} label="esta nota" /></TableCell></TableRow>; })}</TableBody></Table> : <EmptyState icon={<FileText />} title="Nenhuma nota cadastrada" text="Preencha o formulário acima para criar o primeiro lançamento." />}
      </div>
    </div>
  );
}

function ExpensesPanel({ expenses, onSaved, onDelete }: { expenses: Expense[]; onSaved: () => Promise<void>; onDelete: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('Software');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await sendRecord({ type: 'expense', description: form.get('description'), category, expenseDate: form.get('expenseDate'), amountCents: Math.round(Number(form.get('amount')) * 100) });
      event.currentTarget.reset(); setCategory('Software'); await onSaved();
    } finally { setSaving(false); }
  }
  const total = expenses.reduce((sum, expense) => sum + expense.amountCents / 100, 0);
  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Gastos extras" title="Acompanhe as saídas da empresa" description="Lance somente despesas que ainda não fazem parte dos custos fixos configurados, como software, equipamento, viagens e serviços." />
      <div className="mb-5 inline-flex items-center gap-4 rounded-[22px] bg-[#07152f] px-5 py-4 text-white"><div className="grid size-11 place-items-center rounded-xl bg-white/10"><CircleDollarSign /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total lançado</p><strong className="text-2xl">{currency.format(total)}</strong></div></div>
      <form onSubmit={submit} className="grid gap-4 rounded-[22px] border border-slate-200 bg-white p-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto] xl:items-end">
        <Field label="Descrição"><Input name="description" required placeholder="Ex.: Licença anual do software" className="h-11" /></Field>
        <Field label="Categoria"><Select value={category} onValueChange={(value) => setCategory(String(value))}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{['Software', 'Equipamento', 'Viagem', 'Serviços', 'Marketing', 'Outros'].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Data"><Input name="expenseDate" type="date" required defaultValue={today} className="h-11" /></Field>
        <Field label="Valor"><Input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" className="h-11" /></Field>
        <Button type="submit" disabled={saving} className="h-11 bg-[#2f6bff] px-4 hover:bg-[#2457d6]"><Plus />{saving ? 'Salvando' : 'Salvar gasto'}</Button>
      </form>
      <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        {expenses.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead className="pr-5 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{expenses.map((expense) => <TableRow key={expense.id}><TableCell className="pl-5 font-bold text-slate-900">{expense.description}</TableCell><TableCell><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{expense.category}</span></TableCell><TableCell>{shortDate.format(new Date(`${expense.expenseDate}T00:00:00Z`))}</TableCell><TableCell className="font-bold text-orange-700">{currency.format(expense.amountCents / 100)}</TableCell><TableCell className="pr-5 text-right"><DeleteButton onDelete={() => onDelete(expense.id)} label="este gasto" /></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={<WalletCards />} title="Nenhum gasto extra" text="Os custos fixos continuam sendo considerados automaticamente no cálculo." />}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const percentage = (name: string) => Math.round(Number(form.get(name)) * 100);
    const money = (name: string) => Math.round(Number(form.get(name)) * 100);
    try {
      await sendRecord({ type: 'settings', iss: percentage('iss'), pis: percentage('pis'), cofins: percentage('cofins'), irpj: percentage('irpj'), csll: percentage('csll'), inssSocio: percentage('inssSocio'), inssPatronal: percentage('inssPatronal'), proLaboreCents: money('proLabore'), contadorCents: money('contador'), planoSaudeCents: money('planoSaude'), emissaoNotaCents: money('emissaoNota') });
      await onSaved();
    } finally { setSaving(false); }
  }
  const percentValue = (value: number) => value / 100;
  const moneyValue = (value: number) => value / 100;
  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8">
      <PageHeading eyebrow="Parâmetros" title="Ajuste as regras do cálculo" description="Os valores abaixo vieram da planilha enviada. Atualize-os quando houver mudança tributária ou contratual; as simulações e notas salvas usarão os parâmetros atuais." />
      <form onSubmit={submit} className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-7">
        <h3 className="text-lg font-bold text-slate-950">Alíquotas</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([['iss', 'ISS', settings.iss], ['pis', 'PIS', settings.pis], ['cofins', 'COFINS', settings.cofins], ['irpj', 'IRPJ', settings.irpj], ['csll', 'CSLL', settings.csll], ['inssSocio', 'INSS sócio', settings.inssSocio], ['inssPatronal', 'INSS patronal', settings.inssPatronal]] as const).map(([name, label, value]) => <Field key={name} label={`${label} (%)`}><Input name={name} type="number" min="0" step="0.01" required defaultValue={percentValue(value)} className="h-11" /></Field>)}
        </div>
        <div className="my-7 border-t border-slate-100" />
        <h3 className="text-lg font-bold text-slate-950">Custos fixos por nota</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([['proLabore', 'Pró-labore', settings.proLaboreCents], ['contador', 'Contador', settings.contadorCents], ['planoSaude', 'Unimed', settings.planoSaudeCents], ['emissaoNota', 'Emissão da nota', settings.emissaoNotaCents]] as const).map(([name, label, value]) => <Field key={name} label={`${label} (R$)`}><Input name={name} type="number" min="0" step="0.01" required defaultValue={moneyValue(value)} className="h-11" /></Field>)}
        </div>
        <div className="mt-7 flex justify-end"><Button type="submit" disabled={saving} className="h-11 bg-[#2f6bff] px-5 hover:bg-[#2457d6]"><Save />{saving ? 'Salvando' : 'Salvar parâmetros'}</Button></div>
      </form>
    </div>
  );
}

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: ReactNode; tone: 'blue' | 'orange' | 'green' | 'violet' }) {
  const colors = { blue: 'bg-blue-50 text-[#2f6bff]', orange: 'bg-orange-50 text-orange-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/4%)]"><div className={`mb-7 grid size-10 place-items-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></article>;
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2 text-slate-500"><i className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span><strong className="text-slate-900">{currency.format(value)}</strong></div>;
}

function SummaryLine({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"><span className="text-sm text-slate-500">{label}</span><strong className={negative ? 'text-orange-700' : 'text-slate-900'}>{currency.format(value)}</strong></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>{children}</label>;
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'recebida' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status === 'recebida' ? 'Recebida' : 'Pendente'}</span>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="grid place-items-center px-6 py-16 text-center"><div className="mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p></div>;
}

function DeleteButton({ onDelete, label }: { onDelete: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Excluir ${label}`} className="text-slate-400 hover:text-red-600" />}><Trash2 /></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir lançamento?</AlertDialogTitle><AlertDialogDescription>Esta ação remove {label} do histórico e não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { onDelete(); setOpen(false); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

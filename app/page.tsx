'use client';

import { ReactNode, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarRange,
  Calculator,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  UserPlus,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

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
  scope: 'pj' | 'pf';
  paymentMethod: PaymentMethod;
  paymentDetail: string | null;
  installments: number;
  expenseDate: string;
  amountCents: number;
};

type PaymentMethod = 'cartao_credito' | 'cartao_debito' | 'pix' | 'boleto' | 'dinheiro' | 'transferencia' | 'debito_automatico' | 'outros';
type ExpenseCategory = { id: string; name: string; scope: 'pj' | 'pf'; keywords: string; createdAt: string };
type ViewId = 'dashboard' | 'simulator' | 'assistant' | 'invoices' | 'expenses' | 'categories' | 'settings' | 'admin';

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
type AppUser = { displayName: string; email: string; systemRole: 'system_admin' | 'company_admin' };
type AdminCompany = { id: string; name: string; cnpj: string | null; createdAt: string; adminName: string | null; adminEmail: string | null };
type FinanceData = { user: AppUser | null; company: Company | null; invoices: Invoice[]; expenses: Expense[]; categories: ExpenseCategory[]; settings: Settings };

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
const compactMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const today = new Date().toISOString().slice(0, 10);
const companyCategories = ['Software', 'Equipamento', 'Viagem', 'Serviços', 'Marketing', 'Impostos', 'Escritório', 'Saúde', 'Outros'];
const personalCategories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Outros'];
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'debito_automatico', label: 'Débito automático' },
  { value: 'outros', label: 'Outros' },
];
const viewMeta: Record<ViewId, { title: string; description: string }> = {
  dashboard: { title: 'DRE', description: 'Receitas, custos, caixa e comparação mensal' },
  simulator: { title: 'Simulador de nota', description: 'Cálculo do valor líquido de uma nota fiscal' },
  assistant: { title: 'Assistente', description: 'Lançamentos rápidos em linguagem natural' },
  invoices: { title: 'Notas fiscais', description: 'Gestão dos recebimentos de consultoria' },
  expenses: { title: 'Gastos', description: 'Despesas da empresa e da vida pessoal' },
  categories: { title: 'Categorias', description: 'Organização dos gastos pessoais e empresariais' },
  settings: { title: 'Parâmetros', description: 'Impostos e custos usados nos cálculos' },
  admin: { title: 'Administração', description: 'Empresas e acessos liberados' },
};

function paymentLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.value === method)?.label ?? 'Outros';
}

function compactCurrency(value: number) {
  return compactMoney.format(value);
}

function formatMonth(value: string) {
  const [year, monthNumber] = value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [gross, setGross] = useState(23500);
  const [data, setData] = useState<FinanceData>({ user: null, company: null, invoices: [], expenses: [], categories: [], settings: defaultSettings });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const response = await fetch('/api/records', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.reload();
        return;
      }
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
        title: 'Lançar gasto pessoal ou empresarial',
        description: 'Salva um gasto com classificação PF/PJ, categoria, forma de pagamento, data e valor em reais.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' }, category: { type: 'string' },
            expenseDate: { type: 'string', format: 'date' }, amount: { type: 'number', exclusiveMinimum: 0 },
            scope: { type: 'string', enum: ['pj', 'pf'] },
            paymentMethod: { type: 'string', enum: paymentMethods.map((item) => item.value) },
            paymentDetail: { type: 'string' },
            installments: { type: 'integer', minimum: 1, maximum: 48 },
          },
          required: ['description', 'category', 'expenseDate', 'amount', 'scope', 'paymentMethod'], additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const amount = Number(input.amount);
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do gasto precisa ser positivo.');
          const result = await sendRecord({ type: 'expense', installments: 1, ...input, amountCents: Math.round(amount * 100) });
          await loadData();
          return { id: result.id, status: 'salvo' };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadData, data.company]);

  const result = useMemo(() => calculate(gross || 0, data.settings), [gross, data.settings]);
  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 4500);
  };

  const remove = async (type: 'invoice' | 'expense' | 'category', id: string) => {
    const response = await fetch(`/api/records?type=${type}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) return notify('Não foi possível excluir o lançamento.');
    await loadData();
    notify(type === 'category' ? 'Categoria excluída.' : 'Lançamento excluído.');
  };

  const logout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    window.location.reload();
  };

  if (loading) return <LoadingScreen />;

  if (!data.company) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-6 text-center"><div><h1 className="text-2xl font-extrabold text-slate-950">Empresa não encontrada</h1><p className="mt-2 text-sm text-slate-500">Saia da conta e faça um novo cadastro para criar seu ambiente.</p><Button onClick={() => void logout()} className="mt-5 bg-[#2f6bff] hover:bg-[#2457d6]"><LogOut />Sair da conta</Button></div></main>;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar company={data.company} user={data.user} activeView={activeView} onNavigate={setActiveView} onLogout={() => void logout()} />
      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger aria-label="Recolher ou expandir menu" title="Recolher ou expandir menu" className="size-10 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50" />
              <div className="min-w-0"><h1 className="truncate text-base font-extrabold tracking-[-0.02em] text-slate-950 sm:text-lg">{viewMeta[activeView].title}</h1><p className="hidden truncate text-xs text-slate-500 sm:block">{viewMeta[activeView].description}</p></div>
            </div>
            <div className="flex items-center gap-2">
              {activeView !== 'assistant' && <Button type="button" onClick={() => setActiveView('assistant')} className="hidden h-10 rounded-xl bg-[#2f6bff] px-4 shadow-[0_8px_24px_rgb(47_107_255/24%)] hover:bg-[#2457d6] sm:flex"><Sparkles />Novo lançamento</Button>}
              <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700 md:hidden">{data.user?.displayName?.charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </header>

        {message && <output className="fixed bottom-5 left-5 right-5 z-50 rounded-2xl border border-white/10 bg-[#07152f] px-4 py-3 text-sm font-medium text-white shadow-2xl sm:left-auto sm:max-w-sm">{message}</output>}

        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as ViewId)} className="min-w-0 flex-1">
          <TabsContent value="dashboard"><DreDashboard invoices={data.invoices} expenses={data.expenses} settings={data.settings} /></TabsContent>
          <TabsContent value="simulator"><InvoiceSimulator gross={gross} setGross={setGross} result={result} settings={data.settings} /></TabsContent>
          <TabsContent value="assistant"><AssistantPanel categories={data.categories} onSaved={async () => { await loadData(); notify('Lançamento criado pelo assistente.'); }} /></TabsContent>
          <TabsContent value="invoices"><InvoicesPanel invoices={data.invoices} settings={data.settings} onSaved={async () => { await loadData(); notify('Nota fiscal salva com sucesso.'); }} onDelete={(id) => remove('invoice', id)} /></TabsContent>
          <TabsContent value="expenses"><ExpensesPanel expenses={data.expenses} categories={data.categories} onSaved={async () => { await loadData(); notify('Gasto salvo com sucesso.'); }} onCategorySaved={async () => { await loadData(); notify('Categoria cadastrada.'); }} onDelete={(id) => remove('expense', id)} onCategoryDelete={async (id) => { await remove('category', id); }} /></TabsContent>
          <TabsContent value="categories"><CategoriesPanel categories={data.categories} onSaved={async () => { await loadData(); notify('Categoria cadastrada.'); }} onDelete={async (id) => { await remove('category', id); }} /></TabsContent>
          <TabsContent value="settings"><SettingsPanel settings={data.settings} onSaved={async () => { await loadData(); notify('Parâmetros atualizados.'); }} /></TabsContent>
          {data.user?.systemRole === 'system_admin' && <TabsContent value="admin"><AdminPanel notify={notify} /></TabsContent>}
        </Tabs>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({ company, user, activeView, onNavigate, onLogout }: { company: Company; user: AppUser | null; activeView: ViewId; onNavigate: (view: ViewId) => void; onLogout: () => void }) {
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const primaryItems: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'DRE', icon: LayoutDashboard },
    { id: 'simulator', label: 'Simulador de nota', icon: Calculator },
    { id: 'assistant', label: 'Assistente', icon: Sparkles },
    { id: 'invoices', label: 'Notas fiscais', icon: FileText },
    { id: 'expenses', label: 'Gastos PF e PJ', icon: WalletCards },
    { id: 'categories', label: 'Categorias', icon: Tags },
  ];
  const systemItems: Array<{ id: ViewId; label: string; icon: typeof Settings2 }> = [
    { id: 'settings', label: 'Parâmetros', icon: Settings2 },
    ...(user?.systemRole === 'system_admin' ? [{ id: 'admin' as ViewId, label: 'Administração', icon: ShieldCheck }] : []),
  ];
  const navigate = (view: ViewId) => { onNavigate(view); if (isMobile) setOpenMobile(false); };
  const compact = !isMobile && state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className={compact ? 'border-b border-white/10 p-2' : 'border-b border-white/10 p-3'}>
        <button type="button" onClick={() => navigate('dashboard')} aria-label="Ir para o DRE" title={compact ? company.name : undefined} className={`flex h-12 w-full items-center overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[#6f95ff] ${compact ? 'justify-center' : 'gap-3'}`}>
          <span className={`grid shrink-0 place-items-center bg-[#2f6bff] font-black tracking-tight text-white shadow-[0_10px_28px_rgb(47_107_255/35%)] ${compact ? 'size-8 rounded-lg text-[10px]' : 'size-10 rounded-xl text-sm'}`}>KCA</span>
          {!compact && <span className="min-w-0"><strong className="block truncate text-sm text-white">{company.name}</strong><span className="mt-0.5 block text-xs text-slate-400">Gestão financeira</span></span>}
        </button>
      </SidebarHeader>
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 font-bold uppercase tracking-[0.14em] text-slate-500">Financeiro</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{primaryItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton size="lg" tooltip={item.label} isActive={activeView === item.id} onClick={() => navigate(item.id)} className="my-0.5 h-11 rounded-xl px-3 text-slate-300 hover:bg-white/8 hover:text-white data-active:bg-[#2f6bff] data-active:text-white data-active:shadow-[0_8px_22px_rgb(47_107_255/24%)]"><item.icon /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="my-3 group-data-[collapsible=icon]:opacity-0" />
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 font-bold uppercase tracking-[0.14em] text-slate-500">Sistema</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{systemItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton size="lg" tooltip={item.label} isActive={activeView === item.id} onClick={() => navigate(item.id)} className="my-0.5 h-11 rounded-xl px-3 text-slate-300 hover:bg-white/8 hover:text-white data-active:bg-white/10 data-active:text-white"><item.icon /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={compact ? 'items-center border-t border-white/10 p-2' : 'border-t border-white/10 p-2'}>
        <SidebarMenu className={compact ? 'w-8' : 'mb-1'}>
          <SidebarMenuItem>
            <SidebarMenuButton size={compact ? 'default' : 'lg'} tooltip={compact ? 'Expandir menu' : 'Recolher menu'} onClick={toggleSidebar} className="rounded-xl text-slate-400 hover:bg-white/8 hover:text-white">
              {compact ? <PanelLeftOpen /> : <PanelLeftClose />}
              {!compact && <span>{isMobile ? 'Fechar menu' : 'Recolher menu'}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!compact && <div className="flex items-center gap-3 rounded-2xl bg-white/6 p-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-extrabold text-white">{user?.displayName?.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{user?.displayName}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div>
          <button type="button" onClick={onLogout} aria-label="Sair da conta" className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button>
        </div>}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#07152f] text-white"><div className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#2f6bff]"><LoaderCircle className="animate-spin" /></div><p className="mt-4 text-sm font-semibold text-slate-300">Preparando seu ambiente financeiro...</p></div></main>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#2f6bff]">
        <span className="size-1.5 rounded-full bg-[#2f6bff] shadow-[0_0_0_4px_rgb(47_107_255/12%)]" />
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-slate-950 sm:text-[2rem]">{title}</h2>
      <p className="mt-2 max-w-3xl text-base leading-7 text-slate-500">{description}</p>
    </div>
  );
}

function InvoiceSimulator({ gross, setGross, result, settings }: {
  gross: number; setGross: (value: number) => void; result: ReturnType<typeof calculate>;
  settings: Settings;
}) {
  const breakdown = [
    ['ISS', result.iss], ['PIS', result.pis], ['COFINS', result.cofins], ['IRPJ', result.irpj],
    ['CSLL', result.csll], ['INSS patronal', result.inssPatronal], ['Pró-labore bruto', result.proLabore],
    ['Contador', settings.contadorCents / 100], ['Unimed', settings.planoSaudeCents / 100],
    ['Emissão da nota', settings.emissaoNotaCents / 100],
  ] as const;
  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Simulador de nota" title="Quanto fica no seu bolso?" description="Digite o valor bruto da nota. O cálculo considera os tributos, o INSS patronal, o pró-labore e os custos fixos configurados." />
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

      <section className="mt-5">
        <div className="rounded-[22px] border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500">Memória do cálculo</p><h3 className="mt-1 text-lg font-bold text-slate-950">Descontos desta nota</h3></div><ReceiptText className="text-[#2f6bff]" /></div>
          <div className="grid gap-x-8 sm:grid-cols-2">
            {breakdown.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 py-3 text-sm"><span className="text-slate-500">{label}</span><strong className="text-slate-900">{currency.format(value)}</strong></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

type AssistantResult = {
  type: 'expense' | 'invoice';
  createdCategory?: boolean;
  record: {
    description?: string;
    category?: string;
    scope?: 'pj' | 'pf';
    paymentMethod?: PaymentMethod;
    paymentDetail?: string | null;
    installments?: number;
    noteNumber?: string;
    clientName?: string;
    status?: 'recebida' | 'pendente';
    date: string;
    amountCents?: number;
    grossCents?: number;
  };
};

function AssistantPanel({ categories, onSaved }: { categories: ExpenseCategory[]; onSaved: () => Promise<void> }) {
  const [command, setCommand] = useState('');
  const [defaultScope, setDefaultScope] = useState<'pj' | 'pf'>('pj');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<AssistantResult | null>(null);
  const examples = [
    'Paguei R$ 189,90 de internet da empresa no cartão Nubank hoje, categoria Serviços',
    'Gastei R$ 86,40 no supermercado pelo PIX ontem, pessoal',
    'Nota 154 para cliente ACME de R$ 12.000 recebida hoje',
  ];

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!command.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, defaultScope, today }),
      });
      const result = await response.json() as AssistantResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível interpretar o lançamento.');
      setLastResult(result);
      setCommand('');
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar o lançamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8">
      <PageHeading eyebrow="Lançamento rápido" title="Escreva como você fala" description="Conte o que recebeu ou pagou. O assistente identifica os dados e salva o lançamento imediatamente no ambiente da sua empresa." />
      <section className="overflow-hidden rounded-[26px] bg-[#07152f] text-white shadow-[0_24px_70px_rgb(7_21_47/20%)]">
        <div className="border-b border-white/10 p-5 sm:p-7">
          <div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#2f6bff] shadow-[0_10px_30px_rgb(47_107_255/35%)]"><Bot /></div><div><h3 className="text-xl font-bold">Assistente financeiro</h3><p className="mt-1 text-sm leading-6 text-slate-400">Inclua o valor com R$, uma descrição e, se desejar, data, categoria, forma de pagamento, cartão e parcelas.</p></div></div>
        </div>
        <form onSubmit={submit} className="p-5 sm:p-7">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-300">Classificação padrão</span><Select value={defaultScope} onValueChange={(value) => setDefaultScope(value as 'pj' | 'pf')}><SelectTrigger className="h-11 min-w-52 border-white/20 bg-white/10 text-white"><SelectValue>{defaultScope === 'pj' ? 'Empresa (PJ)' : 'Pessoal (PF)'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="pj">Empresa (PJ)</SelectItem><SelectItem value="pf">Pessoal (PF)</SelectItem></SelectContent></Select></label>
            <p className="text-xs text-slate-400">{categories.length} {categories.length === 1 ? 'categoria personalizada disponível' : 'categorias personalizadas disponíveis'}</p>
          </div>
          <label htmlFor="assistant-command" className="mb-2 block text-sm font-semibold text-slate-300">O que deseja lançar?</label>
          <Textarea id="assistant-command" value={command} onChange={(event) => setCommand(event.target.value)} maxLength={500} required placeholder="Ex.: Paguei 318 de Unimed hoje" className="min-h-28 resize-y rounded-2xl border-white/20 bg-white/10 p-4 text-base text-white placeholder:text-slate-400 focus-visible:border-[#6f95ff] focus-visible:ring-[#2f6bff]/30" />
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-300">Você pode informar o valor com ou sem “R$”.</p>
            <Button type="submit" disabled={saving || !command.trim()} className="h-11 bg-[#2f6bff] px-5 hover:bg-[#2457d6]">{saving ? <LoaderCircle className="animate-spin" /> : <Send />}{saving ? 'Interpretando' : 'Interpretar e lançar'}</Button>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p>}
        </form>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3"><Sparkles className="text-[#2f6bff]" /><h3 className="font-bold text-slate-950">Exemplos que ele entende</h3></div>
          <div className="space-y-3">{examples.map((example) => <button key={example} type="button" onClick={() => setCommand(example)} className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left text-sm leading-6 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50">“{example}”</button>)}</div>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3"><ReceiptText className="text-emerald-600" /><h3 className="font-bold text-slate-950">Último lançamento</h3></div>
          {lastResult ? <AssistantResultCard result={lastResult} /> : <p className="text-sm leading-6 text-slate-500">O resumo do próximo lançamento aparecerá aqui para você conferir.</p>}
        </div>
      </section>
    </div>
  );
}

function AssistantResultCard({ result }: { result: AssistantResult }) {
  const record = result.record;
  const value = (record.amountCents ?? record.grossCents ?? 0) / 100;
  return <div className="space-y-3"><div className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 px-4 py-3"><span className="font-bold text-emerald-800">Lançado com sucesso</span><strong className="text-emerald-900">{currency.format(value)}</strong></div><div className="grid gap-2 text-sm"><div className="rounded-xl border border-slate-100 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{result.type === 'invoice' ? 'Nota e cliente' : 'Descrição'}</p><p className="mt-1 font-semibold text-slate-800">{result.type === 'invoice' ? `${record.noteNumber} · ${record.clientName}` : record.description}</p></div><p className="px-1 text-slate-500">{result.type === 'invoice' ? `${record.status === 'pendente' ? 'Pendente' : 'Recebida'} · ${shortDate.format(new Date(`${record.date}T00:00:00Z`))}` : `${record.scope === 'pf' ? 'Pessoal (PF)' : 'Empresa (PJ)'} · ${record.category} · ${paymentLabel(record.paymentMethod ?? 'outros')}`}</p>{result.createdCategory && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">A categoria “{record.category}” também foi cadastrada.</p>}</div></div>;
}

function DreDashboard({ invoices, expenses, settings }: { invoices: Invoice[]; expenses: Expense[]; settings: Settings }) {
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
    const pendingGross = notes.filter((invoice) => invoice.status === 'pendente').reduce((sum, invoice) => sum + invoice.grossCents / 100, 0);
    const taxes = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).taxes, 0);
    const fixed = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).fixed, 0);
    const profit = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).profit, 0);
    const receivedTotal = received.reduce((sum, invoice) => sum + calculate(invoice.grossCents / 100, settings).totalReceived, 0);
    const companyExpenses = monthExpenses.filter((expense) => expense.scope !== 'pf').reduce((sum, expense) => sum + expense.amountCents / 100, 0);
    const personalExpenses = monthExpenses.filter((expense) => expense.scope === 'pf').reduce((sum, expense) => sum + expense.amountCents / 100, 0);
    const noteCount = received.length;
    const proLabore = noteCount * settings.proLaboreCents / 100;
    const contador = noteCount * settings.contadorCents / 100;
    const unimed = noteCount * settings.planoSaudeCents / 100;
    const emissaoNota = noteCount * settings.emissaoNotaCents / 100;
    const proLaboreNet = receivedTotal - profit;
    const adjusted = profit - companyExpenses;
    const cashToOwner = adjusted + proLaboreNet;
    return {
      notes, monthExpenses, gross, taxes, fixed, profit, receivedTotal, companyExpenses, personalExpenses, adjusted,
      proLabore, contador, unimed, emissaoNota, proLaboreNet,
      totalCosts: taxes + fixed + companyExpenses,
      cashToOwner,
      availableAfterPersonal: cashToOwner - personalExpenses,
      noteCount,
      pendingCount: notes.length - noteCount,
      pendingGross,
    };
  };

  const current = summarize(month);
  const previous = summarize(previousMonth);
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1 - (5 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const summary = summarize(key);
    return {
      month: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
      receita: summary.gross,
      empresa: summary.companyExpenses,
      pessoal: summary.personalExpenses,
      saldo: summary.availableAfterPersonal,
    };
  });
  const categoryData = Object.entries(current.monthExpenses.reduce<Record<string, number>>((groups, expense) => {
    groups[expense.category] = (groups[expense.category] ?? 0) + expense.amountCents / 100;
    return groups;
  }, {})).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value).slice(0, 7);

  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageHeading eyebrow="DRE e fluxo de caixa" title="Quanto entrou, quanto custou e quanto sobrou" description="O fechamento considera apenas notas recebidas no mês. Notas pendentes permanecem no histórico, mas não entram no caixa." />
        <Field label="Mês de referência">
          <Select value={month} onValueChange={(value) => setMonth(String(value))}>
            <SelectTrigger className="h-11 min-w-56 bg-white"><SelectValue>{formatMonth(month)}</SelectValue></SelectTrigger>
            <SelectContent>{availableMonths.map((item) => <SelectItem key={item} value={item}>{monthLabel(item)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ComparisonCard label="Receita recebida" current={current.gross} previous={previous.gross} />
        <ComparisonCard label="Gastos da empresa" current={current.companyExpenses} previous={previous.companyExpenses} inverse />
        <ComparisonCard label="Gastos pessoais" current={current.personalExpenses} previous={previous.personalExpenses} inverse />
        <ComparisonCard label="Saldo após todos os gastos" current={current.availableAfterPersonal} previous={previous.availableAfterPersonal} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <FinanceTrendChart data={chartMonths} />
        <CategoryChart data={categoryData} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Demonstrativo do resultado</p><h3 className="mt-1 text-xl font-bold text-slate-950">DRE — {monthLabel(month)}</h3></div><ReceiptText className="text-[#2f6bff]" /></div>
          <div className="space-y-1">
            <DreLine label="Receita bruta recebida" value={current.gross} strong />
            <DreLine label="(-) Tributos e INSS patronal" value={-current.taxes} negative />
            <DreLine label="Receita após impostos" value={current.gross - current.taxes} subtotal />
            <DreLine label="(-) Pró-labore bruto" value={-current.proLabore} negative />
            <DreLine label="(-) Contador" value={-current.contador} negative />
            <DreLine label="(-) Unimed" value={-current.unimed} negative />
            <DreLine label="(-) Emissão das notas" value={-current.emissaoNota} negative />
            <DreLine label="Resultado operacional" value={current.profit} subtotal />
            <DreLine label="(-) Gastos operacionais PJ" value={-current.companyExpenses} negative />
            <DreLine label="Sobra da empresa no mês" value={current.adjusted} result />
          </div>
        </div>

        <div className="rounded-[22px] bg-[#07152f] p-6 text-white shadow-[0_22px_60px_rgb(15_23_42/14%)]">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8babff]">Resumo do caixa</p>
          <h3 className="mt-2 text-xl font-bold">Dinheiro recebido</h3>
          <div className="mt-6 space-y-3">
            <DarkSummaryLine label="Entrou pelas notas" value={current.gross} />
            <DarkSummaryLine label="Saídas da empresa" value={-current.totalCosts} />
            <DarkSummaryLine label="Pró-labore líquido" value={current.proLaboreNet} />
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/7 p-5">
            <p className="text-sm text-slate-300">Total líquido recebido</p>
            <strong className="mt-1 block text-3xl tracking-[-0.04em] text-white">{currency.format(current.cashToOwner)}</strong>
            <div className="my-4 border-t border-white/10" />
            <p className="text-sm text-slate-300">Disponível após gastos pessoais</p>
            <strong className={`mt-1 block text-3xl tracking-[-0.04em] ${current.availableAfterPersonal >= 0 ? 'text-[#b8f58f]' : 'text-red-300'}`}>{currency.format(current.availableAfterPersonal)}</strong>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">Os gastos pessoais ficam fora do DRE da empresa e aparecem somente no saldo disponível.</p>
        </div>
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
              <TableBody>{current.notes.map((invoice) => { const detail = calculate(invoice.grossCents / 100, settings); const inCash = invoice.status === 'recebida'; return <TableRow key={invoice.id}><TableCell className="pl-5 font-bold text-slate-900">{invoice.noteNumber}</TableCell><TableCell>{invoice.clientName}</TableCell><TableCell><StatusBadge status={invoice.status} /></TableCell><TableCell>{currency.format(invoice.grossCents / 100)}</TableCell><TableCell className="text-blue-700">{inCash ? currency.format(detail.taxes) : '—'}</TableCell><TableCell className="text-orange-700">{inCash ? currency.format(detail.fixed) : '—'}</TableCell><TableCell className="font-bold text-emerald-700">{inCash ? currency.format(detail.profit) : '—'}</TableCell><TableCell className="pr-5 font-bold text-slate-900">{inCash ? currency.format(detail.totalReceived) : '—'}</TableCell></TableRow>; })}</TableBody>
            </Table>
          ) : <EmptyState icon={<CalendarRange />} title="Nenhuma nota neste mês" text="Escolha outro período ou registre uma nota fiscal para iniciar o histórico." />}
        </div>

        <aside className="space-y-5">
          <div className="rounded-[22px] bg-[#07152f] p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8babff]">Situação das notas</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/7 p-4"><p className="text-xs text-slate-400">Recebidas</p><strong className="mt-1 block text-2xl">{current.noteCount}</strong></div>
              <div className="rounded-2xl bg-white/7 p-4"><p className="text-xs text-slate-400">Pendentes</p><strong className="mt-1 block text-2xl text-amber-300">{current.pendingCount}</strong></div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4"><p className="text-sm text-slate-400">Ainda a receber</p><strong className="mt-1 block text-2xl tracking-[-0.04em] text-amber-300">{currency.format(current.pendingGross)}</strong></div>
            <div className="mt-4 border-t border-white/10 pt-4"><p className="text-sm text-slate-400">Ticket médio recebido</p><strong className="mt-1 block text-xl">{currency.format(current.noteCount ? current.gross / current.noteCount : 0)}</strong></div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">Resumo dos gastos do mês</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{currency.format(current.companyExpenses + current.personalExpenses)}</h3>
            <div className="mt-4 space-y-3">
              {current.monthExpenses.slice(0, 5).map((expense) => <div key={expense.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><div><p className="font-semibold text-slate-800">{expense.description}</p><p className="mt-0.5 text-xs text-slate-400">{expense.category}</p></div><strong className="text-orange-700">{currency.format(expense.amountCents / 100)}</strong></div>)}
              {!current.monthExpenses.length && <p className="text-sm leading-6 text-slate-500">Nenhum gasto lançado neste período.</p>}
            </div>
          </div>
        </aside>
      </section>

      <ExpenseDetailTable expenses={current.monthExpenses} title={`Gastos detalhados — ${monthLabel(month)}`} />
    </div>
  );
}

function FinanceTrendChart({ data }: { data: Array<{ month: string; receita: number; empresa: number; pessoal: number; saldo: number }> }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><p className="text-sm font-semibold text-slate-500">Evolução em seis meses</p><h3 className="mt-1 text-lg font-bold text-slate-950">Receita, gastos e saldo</h3></div>
        <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-[#2f6bff]"><CalendarRange /></div>
      </div>
      <div className="h-72 w-full" role="img" aria-label="Gráfico da evolução da receita, gastos empresariais, gastos pessoais e saldo nos últimos seis meses">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f6bff" stopOpacity={0.24} /><stop offset="95%" stopColor="#2f6bff" stopOpacity={0} /></linearGradient>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#19a974" stopOpacity={0.2} /><stop offset="95%" stopColor="#19a974" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8edf5" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} width={72} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => compactCurrency(Number(value))} />
            <Tooltip content={<FinanceChartTooltip />} />
            <Area type="monotone" dataKey="receita" name="Receita" stroke="#2f6bff" strokeWidth={3} fill="url(#revenueGradient)" />
            <Area type="monotone" dataKey="saldo" name="Saldo final" stroke="#19a974" strokeWidth={3} fill="url(#balanceGradient)" />
            <Area type="monotone" dataKey="empresa" name="Gastos PJ" stroke="#ff9d42" strokeWidth={2} fill="transparent" />
            <Area type="monotone" dataKey="pessoal" name="Gastos PF" stroke="#8b5cf6" strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
        <ChartKey color="#2f6bff" label="Receita" /><ChartKey color="#ff9d42" label="Gastos PJ" /><ChartKey color="#8b5cf6" label="Gastos PF" /><ChartKey color="#19a974" label="Saldo final" />
      </div>
    </section>
  );
}

function CategoryChart({ data }: { data: Array<{ category: string; value: number }> }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-7">
      <div className="mb-6"><p className="text-sm font-semibold text-slate-500">Onde o dinheiro foi gasto</p><h3 className="mt-1 text-lg font-bold text-slate-950">Categorias do mês</h3></div>
      {data.length ? (
        <div className="h-72 w-full" role="img" aria-label="Gráfico dos gastos do mês agrupados por categoria">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#eef2f7" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} width={90} tick={{ fill: '#475569', fontSize: 12 }} />
              <Tooltip content={<FinanceChartTooltip />} />
              <Bar dataKey="value" name="Total gasto" fill="#ff9d42" radius={[0, 8, 8, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <EmptyState icon={<CircleDollarSign />} title="Sem gastos no mês" text="As categorias aparecerão aqui conforme você registrar despesas." />}
    </section>
  );
}

function FinanceChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>{payload.map((item) => <div key={item.name} className="flex items-center justify-between gap-5 py-1 text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong className="text-slate-900">{currency.format(Number(item.value ?? 0))}</strong></div>)}</div>;
}

function ChartKey({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function ExpenseDetailTable({ expenses, title }: { expenses: Expense[]; title: string }) {
  const total = expenses.reduce((sum, expense) => sum + expense.amountCents / 100, 0);
  return (
    <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-7">
        <div><p className="text-sm font-semibold text-slate-500">Cada saída registrada</p><h3 className="mt-1 text-lg font-bold text-slate-950">{title}</h3></div>
        <div className="rounded-xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800">Total: {currency.format(total)}</div>
      </div>
      {expenses.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Pagamento</TableHead><TableHead>Cartão/conta</TableHead><TableHead className="pr-5 text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{expenses.map((expense) => <TableRow key={expense.id}><TableCell className="pl-5">{shortDate.format(new Date(`${expense.expenseDate}T00:00:00Z`))}</TableCell><TableCell className="font-bold text-slate-900">{expense.description}</TableCell><TableCell><ScopeBadge scope={expense.scope} /></TableCell><TableCell>{expense.category}</TableCell><TableCell>{paymentLabel(expense.paymentMethod)}{expense.installments > 1 ? ` · ${expense.installments}x` : ''}</TableCell><TableCell>{expense.paymentDetail || '—'}</TableCell><TableCell className="pr-5 text-right font-bold text-orange-700">{currency.format(expense.amountCents / 100)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={<WalletCards />} title="Nenhum gasto neste mês" text="Os gastos pessoais e empresariais aparecerão detalhados aqui." />}
    </section>
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

function DreLine({ label, value, strong, negative, subtotal, result }: { label: string; value: number; strong?: boolean; negative?: boolean; subtotal?: boolean; result?: boolean }) {
  if (result) return <div className={`mt-3 flex items-center justify-between gap-4 rounded-2xl px-4 py-4 ${value >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}><span className="font-extrabold">{label}</span><strong className="text-xl">{currency.format(value)}</strong></div>;
  return <div className={`flex items-center justify-between gap-4 border-b border-slate-100 px-1 py-3 text-sm ${subtotal ? 'mt-1 border-t border-slate-200 font-bold text-slate-950' : ''}`}><span className={strong ? 'font-bold text-slate-950' : negative ? 'text-slate-500' : 'text-slate-700'}>{label}</span><strong className={negative ? 'text-orange-700' : 'text-slate-950'}>{currency.format(value)}</strong></div>;
}

function InvoicesPanel({ invoices, settings, onSaved, onDelete }: { invoices: Invoice[]; settings: Settings; onSaved: () => Promise<void>; onDelete: (id: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'recebida' | 'pendente'>('recebida');
  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
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
          <Select value={status} onValueChange={(value) => setStatus(value as 'recebida' | 'pendente')}><SelectTrigger className="h-11 w-full"><SelectValue>{status === 'recebida' ? 'Recebida' : 'Pendente'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="recebida">Recebida</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent></Select>
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

function CategoriesPanel({ categories, onSaved, onDelete }: { categories: ExpenseCategory[]; onSaved: () => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [scope, setScope] = useState<'pj' | 'pf'>('pj');
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const companyItems = categories.filter((item) => item.scope === 'pj');
  const personalItems = categories.filter((item) => item.scope === 'pf');

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await sendRecord({ type: 'category', name: name.trim(), keywords, scope });
      setName('');
      setKeywords('');
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cadastrar a categoria.');
    } finally {
      setSaving(false);
    }
  }

  const group = (title: string, description: string, icon: ReactNode, items: ExpenseCategory[], accent: 'blue' | 'violet') => (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(15_23_42/4%)]">
      <div className="flex items-center gap-3 border-b border-slate-100 p-5">
        <div className={`grid size-11 place-items-center rounded-2xl ${accent === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{icon}</div>
        <div><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{items.length}</span>
      </div>
      {items.length ? <div className="divide-y divide-slate-100">{items.map((item) => (
        <div key={item.id} className="flex min-h-14 items-center gap-3 px-5 py-3">
          <span className={`size-2.5 shrink-0 rounded-full ${accent === 'blue' ? 'bg-[#2f6bff]' : 'bg-violet-500'}`} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>{item.keywords && <p className="mt-0.5 truncate text-xs text-slate-400">Palavras: {item.keywords}</p>}</div>
          <DeleteButton onDelete={() => void onDelete(item.id)} label={`a categoria “${item.name}”`} />
        </div>
      ))}</div> : <EmptyState icon={<Tags />} title="Nenhuma categoria personalizada" text="Use o formulário ao lado para adicionar a primeira categoria deste tipo." />}
    </section>
  );

  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Organização" title="Categorias de gastos" description="Crie categorias próprias para classificar seus gastos. Cada empresa possui sua lista separada, incluindo categorias de Pessoa Física e Pessoa Jurídica." />
      <div className="grid items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <form onSubmit={submit} className="rounded-[22px] bg-[#07152f] p-6 text-white shadow-[0_22px_60px_rgb(15_23_42/14%)] xl:sticky xl:top-24">
          <div className="mb-6 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#2f6bff]"><Plus /></div><div><h3 className="text-lg font-bold">Nova categoria</h3><p className="mt-0.5 text-sm text-slate-400">Escolha onde ela será utilizada.</p></div></div>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-300">Tipo de gasto</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/8 p-1">
              <button type="button" onClick={() => setScope('pj')} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${scope === 'pj' ? 'bg-white text-[#2457d6] shadow-sm' : 'text-slate-300 hover:text-white'}`}>Empresa (PJ)</button>
              <button type="button" onClick={() => setScope('pf')} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${scope === 'pf' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-300 hover:text-white'}`}>Pessoal (PF)</button>
            </div>
          </label>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-slate-300">Nome da categoria</span><Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={40} placeholder="Ex.: Academia, Pets ou Hospedagem" className="h-12 border-white/15 bg-white/10 text-white placeholder:text-slate-500" /></label>
          <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-slate-300">Palavras-chave</span><Input value={keywords} onChange={(event) => setKeywords(event.target.value)} maxLength={300} placeholder="Ex.: Itaú, Nubank, Inter" className="h-12 border-white/15 bg-white/10 text-white placeholder:text-slate-500" /><span className="mt-2 block text-xs leading-5 text-slate-400">Separe por vírgulas. O assistente usará essas palavras para reconhecer a categoria.</span></label>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p>}
          <Button type="submit" disabled={saving || name.trim().length < 2} className="mt-5 h-12 w-full bg-[#2f6bff] hover:bg-[#2457d6]">{saving ? <LoaderCircle className="animate-spin" /> : <Plus />}{saving ? 'Cadastrando' : 'Adicionar categoria'}</Button>
        </form>
        <div className="grid gap-5 lg:grid-cols-2">
          {group('Empresa (PJ)', 'Categorias usadas nos gastos da empresa', <Building2 />, companyItems, 'blue')}
          {group('Pessoal (PF)', 'Categorias usadas nos gastos pessoais', <UsersRound />, personalItems, 'violet')}
        </div>
      </div>
    </div>
  );
}

function CategoryManager({ activeScope, categories, onCreated, onDelete }: { activeScope: 'pj' | 'pf'; categories: ExpenseCategory[]; onCreated: (category: { name: string; scope: 'pj' | 'pf' }) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'pj' | 'pf'>(activeScope);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = formTextValue(form, 'categoryName').trim();
    const keywords = formTextValue(form, 'categoryKeywords').trim();
    try {
      await sendRecord({ type: 'category', name, keywords, scope });
      await onCreated({ name, scope });
      formElement.reset();
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cadastrar a categoria.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); setError(''); if (nextOpen) setScope(activeScope); }}>
      <DialogTrigger render={<Button type="button" variant="outline" className="h-10" />}><Tags />Categorias</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Categorias personalizadas</DialogTitle><DialogDescription>Crie categorias próprias para os gastos da empresa ou da sua vida pessoal.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-4">
          <Field label="Tipo"><Select value={scope} onValueChange={(value) => setScope(value as 'pj' | 'pf')}><SelectTrigger className="h-11 w-full"><SelectValue>{scope === 'pj' ? 'Empresa (PJ)' : 'Pessoal (PF)'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="pj">Empresa (PJ)</SelectItem><SelectItem value="pf">Pessoal (PF)</SelectItem></SelectContent></Select></Field>
          <Field label="Nome da categoria"><Input name="categoryName" required minLength={2} maxLength={40} placeholder="Ex.: Academia, Pets ou Hospedagem" className="h-11" /></Field>
          <Field label="Palavras-chave"><Input name="categoryKeywords" maxLength={300} placeholder="Ex.: Itaú, Nubank, Inter" className="h-11" /></Field>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <DialogFooter><Button type="submit" disabled={saving} className="bg-[#2f6bff] hover:bg-[#2457d6]">{saving ? <LoaderCircle className="animate-spin" /> : <Plus />}{saving ? 'Cadastrando' : 'Adicionar categoria'}</Button></DialogFooter>
        </form>
        <div className="mt-2 border-t border-slate-100 pt-4"><p className="mb-3 text-sm font-bold text-slate-900">Suas categorias</p>{categories.length ? <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{categories.map((item) => <span key={item.id} title={item.keywords ? `Palavras-chave: ${item.keywords}` : undefined} className={`inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-bold ${item.scope === 'pf' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{item.name}<button type="button" onClick={() => void onDelete(item.id)} aria-label={`Excluir categoria ${item.name}`} className="grid size-6 place-items-center rounded-full hover:bg-black/5"><Trash2 className="size-3" /></button></span>)}</div> : <p className="text-sm text-slate-500">Nenhuma categoria personalizada cadastrada.</p>}</div>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesPanel({ expenses, categories, onSaved, onCategorySaved, onDelete, onCategoryDelete }: { expenses: Expense[]; categories: ExpenseCategory[]; onSaved: () => Promise<void>; onCategorySaved: () => Promise<void>; onDelete: (id: string) => void; onCategoryDelete: (id: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'pj' | 'pf'>('pj');
  const [category, setCategory] = useState(companyCategories[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao_credito');
  const [filterScope, setFilterScope] = useState<'all' | 'pj' | 'pf'>('all');
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));

  const availableMonths = useMemo(() => [...new Set([today.slice(0, 7), ...expenses.map((expense) => expense.expenseDate.slice(0, 7))])].sort().reverse(), [expenses]);
  const monthExpenses = expenses.filter((expense) => expense.expenseDate.startsWith(filterMonth));
  const filteredExpenses = monthExpenses.filter((expense) => filterScope === 'all' || expense.scope === filterScope);
  const companyTotal = monthExpenses.filter((expense) => expense.scope !== 'pf').reduce((sum, expense) => sum + expense.amountCents / 100, 0);
  const personalTotal = monthExpenses.filter((expense) => expense.scope === 'pf').reduce((sum, expense) => sum + expense.amountCents / 100, 0);
  const selectableCategories = [...new Set([...(scope === 'pj' ? companyCategories : personalCategories), ...categories.filter((item) => item.scope === scope).map((item) => item.name)])];

  const chooseScope = (value: 'pj' | 'pf') => {
    setScope(value);
    setCategory(value === 'pj' ? companyCategories[0] : personalCategories[0]);
  };

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await sendRecord({
        type: 'expense',
        description: form.get('description'),
        category,
        scope,
        paymentMethod,
        paymentDetail: form.get('paymentDetail'),
        installments: paymentMethod === 'cartao_credito' ? Math.round(Number(form.get('installments') || 1)) : 1,
        expenseDate: form.get('expenseDate'),
        amountCents: Math.round(Number(form.get('amount')) * 100),
      });
      formElement.reset();
      setCategory(scope === 'pj' ? companyCategories[0] : personalCategories[0]);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o gasto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeading eyebrow="Controle de gastos" title="Empresa e vida pessoal no mesmo lugar" description="Classifique cada saída como PJ ou PF. Somente os gastos da empresa entram no DRE; os pessoais reduzem seu saldo disponível." />

      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <ExpenseMetric icon={<Building2 />} label="Gastos da empresa" value={companyTotal} tone="blue" />
        <ExpenseMetric icon={<UsersRound />} label="Gastos pessoais" value={personalTotal} tone="violet" />
        <ExpenseMetric icon={<CircleDollarSign />} label="Total do mês" value={companyTotal + personalTotal} tone="orange" />
      </section>

      <form onSubmit={submit} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/4%)] sm:p-7">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-lg font-bold text-slate-950">Novo gasto</h3><p className="mt-1 text-sm text-slate-500">Informe como e onde o dinheiro foi usado.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => chooseScope('pj')} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${scope === 'pj' ? 'bg-white text-[#2f6bff] shadow-sm' : 'text-slate-500'}`}>Empresa (PJ)</button><button type="button" onClick={() => chooseScope('pf')} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${scope === 'pf' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Pessoal (PF)</button></div><CategoryManager activeScope={scope} categories={categories} onCreated={async (created) => { chooseScope(created.scope); setCategory(created.name); await onCategorySaved(); }} onDelete={onCategoryDelete} /></div></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Descrição"><Input name="description" required maxLength={120} placeholder={scope === 'pj' ? 'Ex.: Licença do software' : 'Ex.: Compra no supermercado'} className="h-11" /></Field>
          <Field label="Categoria"><Select value={category} onValueChange={(value) => setCategory(String(value))}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{selectableCategories.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Data da compra"><Input name="expenseDate" type="date" required defaultValue={today} className="h-11" /></Field>
          <Field label="Valor total"><Input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" className="h-11" /></Field>
          <Field label="Forma de pagamento"><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}><SelectTrigger className="h-11 w-full"><SelectValue>{paymentLabel(paymentMethod)}</SelectValue></SelectTrigger><SelectContent>{paymentMethods.map((item) => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Cartão ou conta (opcional)"><Input name="paymentDetail" maxLength={80} placeholder="Ex.: Nubank final 1234" className="h-11" /></Field>
          {paymentMethod === 'cartao_credito' && <Field label="Parcelas"><Input name="installments" type="number" min="1" max="48" step="1" defaultValue="1" className="h-11" /></Field>}
          <div className="flex items-end"><Button type="submit" disabled={saving} className="h-11 w-full bg-[#2f6bff] px-5 hover:bg-[#2457d6]"><Plus />{saving ? 'Salvando' : `Salvar gasto ${scope.toUpperCase()}`}</Button></div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      </form>

      <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-end sm:px-7">
          <div><p className="text-sm font-semibold text-slate-500">Histórico</p><h3 className="mt-1 text-lg font-bold text-slate-950">Gastos registrados</h3></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Field label="Mês"><Select value={filterMonth} onValueChange={(value) => setFilterMonth(String(value))}><SelectTrigger className="h-10 min-w-44"><SelectValue>{formatMonth(filterMonth)}</SelectValue></SelectTrigger><SelectContent>{availableMonths.map((item) => <SelectItem key={item} value={item}>{formatMonth(item)}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Mostrar"><Select value={filterScope} onValueChange={(value) => setFilterScope(value as 'all' | 'pj' | 'pf')}><SelectTrigger className="h-10 min-w-40"><SelectValue>{filterScope === 'all' ? 'Todos' : filterScope === 'pj' ? 'Empresa (PJ)' : 'Pessoal (PF)'}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pj">Empresa (PJ)</SelectItem><SelectItem value="pf">Pessoal (PF)</SelectItem></SelectContent></Select></Field>
          </div>
        </div>
        {filteredExpenses.length ? <Table><TableHeader><TableRow><TableHead className="pl-5">Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Pagamento</TableHead><TableHead>Cartão/conta</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead className="pr-5 text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredExpenses.map((expense) => <TableRow key={expense.id}><TableCell className="pl-5 font-bold text-slate-900">{expense.description}</TableCell><TableCell><ScopeBadge scope={expense.scope} /></TableCell><TableCell>{expense.category}</TableCell><TableCell>{paymentLabel(expense.paymentMethod)}{expense.installments > 1 ? ` · ${expense.installments}x` : ''}</TableCell><TableCell>{expense.paymentDetail || '—'}</TableCell><TableCell>{shortDate.format(new Date(`${expense.expenseDate}T00:00:00Z`))}</TableCell><TableCell className="font-bold text-orange-700">{currency.format(expense.amountCents / 100)}</TableCell><TableCell className="pr-5 text-right"><DeleteButton onDelete={() => onDelete(expense.id)} label="este gasto" /></TableCell></TableRow>)}</TableBody></Table> : <EmptyState icon={<WalletCards />} title="Nenhum gasto neste filtro" text="Registre uma saída ou escolha outro mês e classificação." />}
      </section>
    </div>
  );
}

function AdminPanel({ notify }: { notify: (text: string) => void }) {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCompanies = useCallback(async () => {
    const response = await fetch('/api/admin', { cache: 'no-store' });
    const result = await response.json() as { companies?: AdminCompany[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Não foi possível carregar as empresas.');
    setCompanies(result.companies ?? []);
  }, []);

  useEffect(() => {
    void loadCompanies().catch((caught) => setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as empresas.')).finally(() => setLoadingCompanies(false));
  }, [loadCompanies]);

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      companyName: formTextValue(form, 'companyName'),
      cnpj: formTextValue(form, 'cnpj'),
      adminName: formTextValue(form, 'adminName'),
      email: formTextValue(form, 'email'),
      password: formTextValue(form, 'password'),
    };
    try {
      const response = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível cadastrar a empresa.');
      formElement.reset();
      await loadCompanies();
      notify('Empresa e usuário cadastrados com sucesso.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cadastrar a empresa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
      <PageHeading eyebrow="Acesso restrito" title="Administração de empresas" description="Cadastre quem poderá usar o sistema. Cada usuário receberá um ambiente financeiro separado para sua empresa." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-[22px] border border-slate-200 bg-white p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-[#2f6bff]"><UserPlus /></div><div><h3 className="text-lg font-bold text-slate-950">Nova empresa</h3><p className="text-sm text-slate-500">Crie o primeiro acesso do responsável.</p></div></div>
          <div className="space-y-4">
            <Field label="Nome da empresa"><Input name="companyName" required maxLength={80} placeholder="Ex.: Empresa Exemplo" className="h-11" /></Field>
            <Field label="CNPJ (opcional)"><Input name="cnpj" inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" className="h-11" /></Field>
            <Field label="Nome do responsável"><Input name="adminName" required maxLength={80} placeholder="Nome completo" className="h-11" /></Field>
            <Field label="E-mail de acesso"><Input name="email" type="email" autoComplete="off" required placeholder="responsavel@empresa.com.br" className="h-11" /></Field>
            <Field label="Senha inicial"><Input name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="Mínimo 10 caracteres" className="h-11" /></Field>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">Informe a senha inicial ao responsável por um canal seguro.</p>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" disabled={saving} className="mt-5 h-11 w-full bg-[#2f6bff] hover:bg-[#2457d6]">{saving ? <LoaderCircle className="animate-spin" /> : <UserPlus />}{saving ? 'Cadastrando' : 'Cadastrar empresa'}</Button>
        </form>

        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7"><div><h3 className="text-lg font-bold text-slate-950">Empresas liberadas</h3><p className="mt-1 text-sm text-slate-500">{companies.length} {companies.length === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}</p></div><ShieldCheck className="text-emerald-600" /></div>
          {loadingCompanies ? <div className="grid min-h-52 place-items-center text-slate-400"><LoaderCircle className="animate-spin" /></div> : companies.length === 0 ? <EmptyState icon={<Building2 />} title="Nenhuma empresa cadastrada" text="Use o formulário para liberar o primeiro acesso." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Responsável</TableHead><TableHead>E-mail</TableHead><TableHead>Cadastro</TableHead></TableRow></TableHeader>
              <TableBody>{companies.map((company) => <TableRow key={company.id}><TableCell><p className="font-bold text-slate-900">{company.name}</p><p className="text-xs text-slate-400">{company.cnpj || 'CNPJ não informado'}</p></TableCell><TableCell>{company.adminName ?? '—'}</TableCell><TableCell>{company.adminEmail ?? '—'}</TableCell><TableCell>{shortDate.format(new Date(company.createdAt))}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
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

function ExpenseMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: 'blue' | 'violet' | 'orange' }) {
  const colors = { blue: 'bg-blue-50 text-[#2f6bff]', violet: 'bg-violet-50 text-violet-700', orange: 'bg-orange-50 text-orange-700' };
  return <article className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-5"><div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${colors[tone]}`}>{icon}</div><div><p className="text-sm font-semibold text-slate-500">{label}</p><strong className="mt-1 block text-2xl tracking-[-0.04em] text-slate-950">{currency.format(value)}</strong></div></article>;
}

function Metric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: ReactNode; tone: 'blue' | 'orange' | 'green' | 'violet' }) {
  const colors = { blue: 'bg-blue-50 text-[#2f6bff]', orange: 'bg-orange-50 text-orange-600', green: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgb(15_23_42/4%)]"><div className={`mb-7 grid size-10 place-items-center rounded-xl ${colors[tone]}`}>{icon}</div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></article>;
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="flex items-center gap-2 text-slate-500"><i className="size-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span><strong className="text-slate-900">{currency.format(value)}</strong></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>{children}</label>;
}

function formTextValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'recebida' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{status === 'recebida' ? 'Recebida' : 'Pendente'}</span>;
}

function ScopeBadge({ scope }: { scope: Expense['scope'] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${scope === 'pf' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{scope === 'pf' ? 'Pessoal (PF)' : 'Empresa (PJ)'}</span>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="grid place-items-center px-6 py-16 text-center"><div className="mb-4 grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p></div>;
}

function DeleteButton({ onDelete, label }: { onDelete: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  const isCategory = label.startsWith('a categoria');
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Excluir ${label}`} className="text-slate-400 hover:text-red-600" />}><Trash2 /></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{isCategory ? 'Excluir categoria?' : 'Excluir lançamento?'}</AlertDialogTitle><AlertDialogDescription>Esta ação remove {label} e não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { onDelete(); setOpen(false); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

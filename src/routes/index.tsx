import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import heroBg from "@/assets/hero-bg.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  FileBarChart,
  Settings,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "B.I. Variação de Compras | Polímeros" },
      {
        name: "description",
        content:
          "Painel B.I. para análise de variação de preços e volumes de compras de matéria-prima.",
      },
    ],
  }),
});

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const priceData = months.map((m, i) => ({
  mes: m,
  preco: 8.2 + Math.sin(i / 1.6) * 1.1 + i * 0.08,
  media: 8.6 + i * 0.05,
}));

const volumeData = [
  { mat: "PEAD", atual: 420, anterior: 360 },
  { mat: "PEBD", atual: 310, anterior: 340 },
  { mat: "PP", atual: 510, anterior: 470 },
  { mat: "PVC", atual: 260, anterior: 300 },
  { mat: "PET", atual: 380, anterior: 320 },
  { mat: "PS", atual: 180, anterior: 210 },
];

const supplierData = months.map((m, i) => ({
  mes: m,
  fornA: 120 + Math.cos(i) * 20 + i * 3,
  fornB: 90 + Math.sin(i / 2) * 25 + i * 2,
  fornC: 70 + Math.cos(i / 1.3) * 15 + i * 1.5,
}));

const kpis = [
  { label: "Compras no mês", value: "R$ 4,82 M", delta: "+8,4%", up: true },
  { label: "Variação de preço", value: "+3,2%", delta: "vs. mês ant.", up: true },
  { label: "Volume (ton)", value: "2.060", delta: "+12,1%", up: true },
  { label: "Custo médio /kg", value: "R$ 9,14", delta: "-1,8%", up: false },
];

const navItems = [
  { icon: LayoutDashboard, label: "Visão Geral", active: true },
  { icon: Package, label: "Matérias-primas" },
  { icon: TrendingUp, label: "Variação" },
  { icon: Truck, label: "Fornecedores" },
  { icon: FileBarChart, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

function Dashboard() {
  const [period, setPeriod] = useState("12m");
  const totalVar = useMemo(
    () =>
      (
        ((volumeData.reduce((a, b) => a + b.atual, 0) -
          volumeData.reduce((a, b) => a + b.anterior, 0)) /
          volumeData.reduce((a, b) => a + b.anterior, 0)) *
        100
      ).toFixed(1),
    [],
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex">
        <div className="mb-8 flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">PolyBI</span>
            <span className="text-xs text-muted-foreground">Compras & Insumos</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-border/40 p-3 text-xs text-muted-foreground">
          Dados atualizados há 12 min
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        {/* Hero header with background image */}
        <header
          className="relative overflow-hidden border-b border-border"
          style={{
            backgroundImage: `linear-gradient(90deg, oklch(0.22 0.04 155 / 0.55), oklch(0.22 0.04 155 / 0.25)), url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="px-6 py-10 md:px-10 md:py-14">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <Badge className="mb-3 bg-accent text-accent-foreground hover:bg-accent">
                  B.I. Compras
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Variação de Compras de Polímeros
                </h1>
                <p className="mt-2 text-sm text-foreground/85 md:text-base">
                  Monitore preços, volumes e fornecedores em tempo real para decisões de
                  abastecimento mais inteligentes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Buscar item, fornecedor..."
                    className="h-10 w-64 rounded-md border border-border bg-background/70 pl-9 pr-3 text-sm backdrop-blur placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-10 w-32 bg-background/70 backdrop-blur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3m">3 meses</SelectItem>
                    <SelectItem value="6m">6 meses</SelectItem>
                    <SelectItem value="12m">12 meses</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Exportar
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="px-6 py-6 md:px-10">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-semibold">{k.value}</span>
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${
                        k.up ? "text-accent" : "text-destructive"
                      }`}
                    >
                      {k.up ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {k.delta}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Variação do Preço Médio (R$/kg)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="preco"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#g1)"
                    />
                    <Line
                      type="monotone"
                      dataKey="media"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Variação Total de Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-4xl font-semibold text-accent">+{totalVar}%</span>
                  <span className="text-sm text-muted-foreground">vs. período anterior</span>
                </div>
                <div className="mt-6 space-y-3">
                  {volumeData.map((v) => {
                    const diff = ((v.atual - v.anterior) / v.anterior) * 100;
                    const positive = diff >= 0;
                    return (
                      <div key={v.mat} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{v.mat}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{v.atual} t</span>
                          <span
                            className={`min-w-14 text-right text-xs font-medium ${
                              positive ? "text-accent" : "text-destructive"
                            }`}
                          >
                            {positive ? "+" : ""}
                            {diff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Volume por Matéria-prima (ton)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={volumeData}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mat" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="anterior" name="Anterior" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="atual" name="Atual" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Compras por Fornecedor (R$ mil)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <LineChart data={supplierData}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="fornA" name="Braskem" stroke="var(--color-primary)" strokeWidth={2} />
                    <Line type="monotone" dataKey="fornB" name="Dow" stroke="var(--color-accent)" strokeWidth={2} />
                    <Line type="monotone" dataKey="fornC" name="Unipar" stroke="var(--color-chart-3)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

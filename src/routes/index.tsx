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
  LabelList,
} from "recharts";
import heroBg from "@/assets/hero-bg.png";
import entradas from "@/data/entradas.json";
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
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "B.I. Variação de Compras" },
      {
        name: "description",
        content:
          "Painel B.I. de variação de compras por matéria-prima — preço/kg, valor e variação % mensal.",
      },
    ],
  }),
});

type MonthEntry = { vlr: number; qtd: number; unit: number };
type Material = { name: string; months: Record<string, MonthEntry> };

// Filter out spurious "Total" months that came from the pivot export.
const ALL_MONTHS = (entradas.months as string[]).filter((m) => /^\d{2}\/\d{4}$/.test(m));
const MATERIALS = (entradas.materials as unknown as Material[])
  .map((m) => ({
    ...m,
    months: Object.fromEntries(
      Object.entries(m.months).filter(([k]) => /^\d{2}\/\d{4}$/.test(k)),
    ) as Record<string, MonthEntry>,
  }))
  .filter((m) => Object.keys(m.months).length >= 2)
  .sort(
    (a, b) =>
      Object.values(b.months).reduce((s, v) => s + (v.vlr || 0), 0) -
      Object.values(a.months).reduce((s, v) => s + (v.vlr || 0), 0),
  );

const navItems = [
  { icon: LayoutDashboard, label: "Visão Geral", active: true },
  { icon: Package, label: "Matérias-primas" },
  { icon: TrendingUp, label: "Variação" },
  { icon: Truck, label: "Fornecedores" },
  { icon: FileBarChart, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLk = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(2)} M`
    : v >= 1000
      ? `R$ ${(v / 1000).toFixed(1)} k`
      : fmtBRL(v);
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

function Dashboard() {
  const [selected, setSelected] = useState<string>(MATERIALS[0]?.name ?? "");

  const material = useMemo(
    () => MATERIALS.find((m) => m.name === selected) ?? MATERIALS[0],
    [selected],
  );

  // Series for selected material (sorted by month)
  const series = useMemo(() => {
    const keys = Object.keys(material.months).sort();
    return keys.map((mes, i, arr) => {
      const cur = material.months[mes];
      const prev = i > 0 ? material.months[arr[i - 1]] : null;
      const varValor = prev && prev.vlr ? ((cur.vlr - prev.vlr) / prev.vlr) * 100 : 0;
      const varPreco = prev && prev.unit ? ((cur.unit - prev.unit) / prev.unit) * 100 : 0;
      return {
        mes,
        valor: cur.vlr,
        qtd: cur.qtd,
        preco: cur.unit,
        varValor: Number(varValor.toFixed(2)),
        varPreco: Number(varPreco.toFixed(2)),
      };
    });
  }, [material]);

  // Overall by-month aggregate
  const overall = useMemo(() => {
    return ALL_MONTHS.sort().map((mes, i, arr) => {
      const total = MATERIALS.reduce((s, m) => s + (m.months[mes]?.vlr ?? 0), 0);
      const prevTotal = i > 0 ? MATERIALS.reduce((s, m) => s + (m.months[arr[i - 1]]?.vlr ?? 0), 0) : 0;
      const variacao = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0;
      return { mes, total, variacao: Number(variacao.toFixed(2)) };
    });
  }, []);

  const totalMat = series.reduce((s, x) => s + x.valor, 0);
  const qtdMat = series.reduce((s, x) => s + x.qtd, 0);
  const precoMedio = qtdMat ? totalMat / qtdMat : 0;
  const varTotal = series.length > 1 ? ((series.at(-1)!.valor - series[0].valor) / series[0].valor) * 100 : 0;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
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
          {MATERIALS.length} materiais · {ALL_MONTHS.length} meses
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className="relative overflow-hidden border-b border-border"
          style={{
            backgroundImage: `linear-gradient(90deg, oklch(0.22 0.04 155 / 0.6), oklch(0.22 0.04 155 / 0.25)), url(${heroBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="px-6 py-10 md:px-10 md:py-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <Badge className="mb-3 bg-accent text-accent-foreground hover:bg-accent">
                  B.I. Compras
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Variação de Compras — Análise de Entradas
                </h1>
                <p className="mt-2 text-sm text-foreground/85 md:text-base">
                  Compare meses, preço por kg e variação % do valor de compra por matéria-prima.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger className="h-10 w-80 bg-background/80 backdrop-blur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    {MATERIALS.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
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
            {[
              { label: "Compra total", value: fmtBRLk(totalMat), delta: `${series.length} meses`, up: true },
              {
                label: "Variação do período",
                value: fmtPct(varTotal),
                delta: `${series[0]?.mes} → ${series.at(-1)?.mes}`,
                up: varTotal >= 0,
              },
              { label: "Quantidade total", value: qtdMat.toLocaleString("pt-BR"), delta: "kg", up: true },
              { label: "Preço médio /kg", value: fmtBRL(precoMedio), delta: "ponderado", up: true },
            ].map((k) => (
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
                      {k.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {k.delta}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Variação % mês a mês */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Variação % — Valor de Compra (mês a mês)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={series} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(v: number) => `${v.toFixed(2)}%`}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="varValor" name="Variação Valor" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="varValor"
                        position="top"
                        formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                      {series.map((s, i) => (
                        <Bar
                          key={i}
                          dataKey="varValor"
                          fill={s.varValor >= 0 ? "var(--color-accent)" : "var(--color-destructive)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Variação % — Preço por kg (mês a mês)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={series} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(v: number) => `${v.toFixed(2)}%`}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="varPreco" name="Variação Preço" fill="var(--color-primary)" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="varPreco"
                        position="top"
                        formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Preço por kg + Valor compra */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Preço por kg (R$/kg)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `R$ ${v.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number) => `R$ ${v.toFixed(4)} /kg`}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="preco"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Valor de Compra por Mês</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtBRL(v)}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#gValor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Overall */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">Compras Totais por Mês (todos os materiais)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={overall} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`)}
                    />
                    <Tooltip
                      formatter={(v: number, n: string) =>
                        n === "total" ? fmtBRL(v) : `${v.toFixed(2)}%`
                      }
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Valor total" fill="var(--color-primary)" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="variacao"
                        position="top"
                        formatter={(v: number) =>
                          v === 0 ? "" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
                        }
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

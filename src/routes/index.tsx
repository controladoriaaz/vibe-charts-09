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
  Cell,
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
          "Painel B.I. de variação de compras por matéria-prima e grupo de produto — preço/kg, valor e variação % mensal.",
      },
    ],
  }),
});

type MonthEntry = { vlr: number; qtd: number; unit: number };
type Material = { name: string; grupo: string; months: Record<string, MonthEntry> };

const ALL_MONTHS = (entradas.months as string[]).filter((m) => /^\d{2}\/\d{4}$/.test(m));
const MATERIALS = (entradas.materials as unknown as Material[])
  .map((m) => ({
    ...m,
    months: Object.fromEntries(
      Object.entries(m.months).filter(([k]) => /^\d{2}\/\d{4}$/.test(k)),
    ) as Record<string, MonthEntry>,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const GRUPOS = Array.from(new Set(MATERIALS.map((m) => m.grupo))).sort((a, b) =>
  a.localeCompare(b, "pt-BR"),
);

// Distinct color per grupo (HSL palette)
const GRUPO_COLORS: Record<string, string> = {};
GRUPOS.forEach((g, i) => {
  const hue = Math.round((360 / GRUPOS.length) * i);
  GRUPO_COLORS[g] = `hsl(${hue} 70% 55%)`;
});

const navItems = [
  { icon: LayoutDashboard, label: "Visão Geral", active: true },
  { icon: Package, label: "Matérias-primas" },
  { icon: TrendingUp, label: "Variação" },
  { icon: Truck, label: "Fornecedores" },
  { icon: FileBarChart, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

const monthKey = (m: string) => {
  const [mm, yy] = m.split("/").map(Number);
  return yy * 12 + mm;
};
const sortMonths = (a: string, b: string) => monthKey(a) - monthKey(b);

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
  const sortedMonths = useMemo(() => [...ALL_MONTHS].sort(sortMonths), []);
  const [selected, setSelected] = useState<string>(MATERIALS[0]?.name ?? "");
  const [mesBase, setMesBase] = useState<string>(sortedMonths[0] ?? "");
  const [mesComp, setMesComp] = useState<string>(sortedMonths[sortedMonths.length - 1] ?? "");

  // Continuous range between mesBase and mesComp (inclusive, ordered).
  const rangeMonths = useMemo(() => {
    if (!mesBase || !mesComp) return [];
    const a = monthKey(mesBase);
    const b = monthKey(mesComp);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return sortedMonths.filter((m) => {
      const k = monthKey(m);
      return k >= lo && k <= hi;
    });
  }, [mesBase, mesComp, sortedMonths]);

  const material = useMemo(
    () => MATERIALS.find((m) => m.name === selected) ?? MATERIALS[0],
    [selected],
  );

  // Series for selected material across the selected month range.
  const series = useMemo(() => {
    return rangeMonths.map((mes, i) => {
      const cur = material.months[mes] ?? { vlr: 0, qtd: 0, unit: 0 };
      const prev = i > 0 ? (material.months[rangeMonths[i - 1]] ?? null) : null;
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
  }, [material, rangeMonths]);

  // Overall total per month in range.
  const overall = useMemo(() => {
    return rangeMonths.map((mes, i, arr) => {
      const total = MATERIALS.reduce((s, m) => s + (m.months[mes]?.vlr ?? 0), 0);
      const prevTotal =
        i > 0 ? MATERIALS.reduce((s, m) => s + (m.months[arr[i - 1]]?.vlr ?? 0), 0) : 0;
      const variacao = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0;
      return { mes, total, variacao: Number(variacao.toFixed(2)) };
    });
  }, [rangeMonths]);

  // Compras por grupo de produto ao longo do range (uma série por grupo).
  const grupoSeries = useMemo(() => {
    return rangeMonths.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const g of GRUPOS) {
        row[g] = MATERIALS.filter((m) => m.grupo === g).reduce(
          (s, m) => s + (m.months[mes]?.vlr ?? 0),
          0,
        );
      }
      return row;
    });
  }, [rangeMonths]);

  // Variação total por grupo (último mês vs primeiro mês do range).
  const grupoVar = useMemo(() => {
    if (rangeMonths.length < 1) return [];
    const first = rangeMonths[0];
    const last = rangeMonths[rangeMonths.length - 1];
    return GRUPOS.map((g) => {
      const base = MATERIALS.filter((m) => m.grupo === g).reduce(
        (s, m) => s + (m.months[first]?.vlr ?? 0),
        0,
      );
      const atual = MATERIALS.filter((m) => m.grupo === g).reduce(
        (s, m) => s + (m.months[last]?.vlr ?? 0),
        0,
      );
      const variacao = base ? ((atual - base) / base) * 100 : atual > 0 ? 100 : 0;
      return { grupo: g, base, atual, variacao: Number(variacao.toFixed(2)) };
    }).sort((a, b) => b.variacao - a.variacao);
  }, [rangeMonths]);

  const totalMat = series.reduce((s, x) => s + x.valor, 0);
  const qtdMat = series.reduce((s, x) => s + x.qtd, 0);
  const precoMedio = qtdMat ? totalMat / qtdMat : 0;
  const varTotal =
    series.length > 1 && series[0].valor
      ? ((series.at(-1)!.valor - series[0].valor) / series[0].valor) * 100
      : 0;

  // Ranking: variação do último mês vs primeiro mês do range (preço/kg).
  const ranking = useMemo(() => {
    if (rangeMonths.length < 1) return [];
    const first = rangeMonths[0];
    const last = rangeMonths[rangeMonths.length - 1];
    return MATERIALS.map((m) => {
      const atual = m.months[last]?.unit ?? 0;
      const base = m.months[first]?.unit ?? 0;
      const variacao = base > 0 ? ((atual - base) / base) * 100 : atual > 0 ? 100 : 0;
      return {
        name: m.name,
        grupo: m.grupo,
        atual,
        base,
        baseMes: first,
        atualMes: last,
        variacao: Number(variacao.toFixed(2)),
      };
    })
      .filter((r) => r.atual > 0 || r.base > 0)
      .sort((a, b) => b.variacao - a.variacao);
  }, [rangeMonths]);

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
          {MATERIALS.length} materiais · {GRUPOS.length} grupos · {ALL_MONTHS.length} meses
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
                  Compare meses, preço por kg e variação % do valor de compra por matéria-prima e
                  grupo de produto.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <Select value={mesBase} onValueChange={setMesBase}>
                  <SelectTrigger className="h-10 w-32 bg-background/80 backdrop-blur">
                    <SelectValue placeholder="Mês inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-foreground/80">até</span>
                <Select value={mesComp} onValueChange={setMesComp}>
                  <SelectTrigger className="h-10 w-32 bg-background/80 backdrop-blur">
                    <SelectValue placeholder="Mês final" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Exportar
                </Button>
              </div>
            </div>
            {rangeMonths.length > 0 && (
              <div className="mt-3 text-xs text-foreground/75">
                Período analisado: {rangeMonths.join(" → ")}
              </div>
            )}
          </div>
        </header>

        <section className="px-6 py-6 md:px-10">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Compra total (material)",
                value: fmtBRLk(totalMat),
                delta: `${rangeMonths.length} meses`,
                up: true,
              },
              {
                label: "Variação do período",
                value: fmtPct(varTotal),
                delta: `${rangeMonths[0] ?? "—"} → ${rangeMonths.at(-1) ?? "—"}`,
                up: varTotal >= 0,
              },
              {
                label: "Quantidade total",
                value: qtdMat.toLocaleString("pt-BR"),
                delta: "kg",
                up: true,
              },
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

          {/* Compras por Grupo de Produto */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Compras por Grupo de Produto — evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer>
                  <LineChart data={grupoSeries} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : `${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(v: number, n: string) => [fmtBRL(v), n]}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {GRUPOS.map((g) => (
                      <Line
                        key={g}
                        type="monotone"
                        dataKey={g}
                        stroke={GRUPO_COLORS[g]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Variação total por grupo no período */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Variação por Grupo no Período — {rangeMonths[0] ?? "—"} →{" "}
                  {rangeMonths.at(-1) ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={grupoVar} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="grupo" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(
                        v: number,
                        _n,
                        p: { payload?: { base?: number; atual?: number } },
                      ) => [
                        `${v.toFixed(2)}% — ${fmtBRL(p.payload?.base ?? 0)} → ${fmtBRL(p.payload?.atual ?? 0)}`,
                        "Variação",
                      ]}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="variacao" radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey="variacao"
                        position="top"
                        formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                      {grupoVar.map((r, i) => (
                        <Cell key={i} fill={GRUPO_COLORS[r.grupo]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Variação % mês a mês — material selecionado */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Variação % — Valor de Compra (mês a mês)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={series} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number, _n, p: { payload?: { valor?: number } }) => [
                        `${v.toFixed(2)}% — ${fmtBRL(p.payload?.valor ?? 0)}`,
                        "Variação Valor",
                      ]}
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
                        <Cell
                          key={i}
                          fill={
                            s.varValor >= 0 ? "var(--color-accent)" : "var(--color-destructive)"
                          }
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
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number, _n, p: { payload?: { preco?: number } }) => [
                        `${v.toFixed(2)}% — R$ ${(p.payload?.preco ?? 0).toFixed(4)}/kg`,
                        "Variação Preço",
                      ]}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="varPreco"
                      name="Variação Preço"
                      fill="var(--color-primary)"
                      radius={[6, 6, 0, 0]}
                    >
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

          {/* Compras totais por mês */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Compras Totais por Mês (todos os materiais)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <BarChart data={overall} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : `${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(v: number) => fmtBRL(v)}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="total"
                      name="Valor total"
                      fill="var(--color-primary)"
                      radius={[6, 6, 0, 0]}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v: number) => fmtBRLk(v)}
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Ranking */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Ranking de Variação do Preço/kg — {rangeMonths.at(-1) ?? "—"} vs{" "}
                  {rangeMonths[0] ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(360, ranking.length * 26) }}>
                <ResponsiveContainer>
                  <BarChart
                    data={ranking}
                    layout="vertical"
                    margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={260}
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      interval={0}
                    />
                    <Tooltip
                      formatter={(
                        v: number,
                        _n,
                        p: {
                          payload?: {
                            baseMes?: string;
                            atualMes?: string;
                            atual?: number;
                            base?: number;
                            grupo?: string;
                          };
                        },
                      ) => {
                        const d = p.payload ?? {};
                        return [
                          `${v.toFixed(2)}% (${d.baseMes ?? "-"} → ${d.atualMes ?? "-"})`,
                          `${d.grupo ?? ""} · R$ ${(d.base ?? 0).toFixed(4)}/kg → R$ ${(d.atual ?? 0).toFixed(4)}/kg`,
                        ];
                      }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey="variacao"
                        position="right"
                        formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                        fontSize={11}
                        fill="var(--color-foreground)"
                      />
                      {ranking.map((r, i) => (
                        <Cell key={i} fill={GRUPO_COLORS[r.grupo] ?? "var(--color-primary)"} />
                      ))}
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

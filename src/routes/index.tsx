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
  Legend,
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
          "Painel B.I. de variação de compras por matéria-prima e grupo de produto — preço unitário e quantidade mensal.",
      },
    ],
  }),
});

type MonthEntry = { vlr: number; qtd: number; unit: number };
type Material = { name: string; grupo: string; months: Record<string, MonthEntry> };

const ALL_MONTHS = (entradas.months as string[]).filter((m) => /^\d{2}\/\d{4}$/.test(m));

// Considera apenas notas/faturamentos válidos: entradas com quantidade E valor > 0
// (desconsidera notas de remessa, devoluções e lançamentos sem preço).
const isValidEntry = (e: MonthEntry | undefined): e is MonthEntry =>
  !!e && e.qtd > 0 && e.vlr > 0 && e.unit > 0;

const MATERIALS = (entradas.materials as unknown as Material[])
  .map((m) => ({
    ...m,
    months: Object.fromEntries(
      Object.entries(m.months).filter(([k, v]) => /^\d{2}\/\d{4}$/.test(k) && isValidEntry(v)),
    ) as Record<string, MonthEntry>,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const GRUPOS = Array.from(new Set(MATERIALS.map((m) => m.grupo))).sort((a, b) =>
  a.localeCompare(b, "pt-BR"),
);

const GRUPO_COLORS: Record<string, string> = {};
GRUPOS.forEach((g, i) => {
  const hue = Math.round((360 / Math.max(GRUPOS.length, 1)) * i);
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
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const fmtKg = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)} M kg`
    : v >= 1000
      ? `${(v / 1000).toFixed(1)} k kg`
      : `${v.toLocaleString("pt-BR")} kg`;

// Preço unitário médio ponderado (R$/kg) de um conjunto de entradas válidas.
const weightedUnit = (entries: MonthEntry[]) => {
  const v = entries.reduce((s, e) => s + e.vlr, 0);
  const q = entries.reduce((s, e) => s + e.qtd, 0);
  return q > 0 ? v / q : 0;
};

function Dashboard() {
  const sortedMonths = useMemo(() => [...ALL_MONTHS].sort(sortMonths), []);
  const [selected, setSelected] = useState<string>(MATERIALS[0]?.name ?? "");
  const [mesBase, setMesBase] = useState<string>(sortedMonths[0] ?? "");
  const [mesComp, setMesComp] = useState<string>(sortedMonths[sortedMonths.length - 1] ?? "");

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

  // Série do material: preço unitário e quantidade por mês do período.
  const series = useMemo(() => {
    return rangeMonths.map((mes, i) => {
      const cur = material?.months[mes];
      const prev = i > 0 ? material?.months[rangeMonths[i - 1]] : undefined;
      const preco = cur?.unit ?? 0;
      const qtd = cur?.qtd ?? 0;
      const varPreco = prev && prev.unit ? ((preco - prev.unit) / prev.unit) * 100 : 0;
      const varQtd = prev && prev.qtd ? ((qtd - prev.qtd) / prev.qtd) * 100 : 0;
      return {
        mes,
        preco: Number(preco.toFixed(4)),
        qtd: Number(qtd.toFixed(2)),
        varPreco: Number(varPreco.toFixed(2)),
        varQtd: Number(varQtd.toFixed(2)),
      };
    });
  }, [material, rangeMonths]);

  // Preço unitário médio ponderado por Grupo — evolução mensal.
  const grupoPrecoSeries = useMemo(() => {
    return rangeMonths.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const g of GRUPOS) {
        const entries = MATERIALS.filter((m) => m.grupo === g)
          .map((m) => m.months[mes])
          .filter(isValidEntry);
        row[g] = Number(weightedUnit(entries).toFixed(4));
      }
      return row;
    });
  }, [rangeMonths]);

  // Quantidade total (kg) por Grupo — evolução mensal.
  const grupoQtdSeries = useMemo(() => {
    return rangeMonths.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const g of GRUPOS) {
        row[g] = MATERIALS.filter((m) => m.grupo === g).reduce(
          (s, m) => s + (m.months[mes]?.qtd ?? 0),
          0,
        );
      }
      return row;
    });
  }, [rangeMonths]);

  // Variação % do preço unitário por Grupo (último vs primeiro mês do período).
  const grupoVar = useMemo(() => {
    if (rangeMonths.length < 1) return [];
    const first = rangeMonths[0];
    const last = rangeMonths[rangeMonths.length - 1];
    return GRUPOS.map((g) => {
      const mats = MATERIALS.filter((m) => m.grupo === g);
      const baseEntries = mats.map((m) => m.months[first]).filter(isValidEntry);
      const atualEntries = mats.map((m) => m.months[last]).filter(isValidEntry);
      const base = weightedUnit(baseEntries);
      const atual = weightedUnit(atualEntries);
      const variacao = base > 0 ? ((atual - base) / base) * 100 : atual > 0 ? 100 : 0;
      return {
        grupo: g,
        base: Number(base.toFixed(4)),
        atual: Number(atual.toFixed(4)),
        variacao: Number(variacao.toFixed(2)),
      };
    }).sort((a, b) => b.variacao - a.variacao);
  }, [rangeMonths]);

  // Totais por mês (todos os materiais): preço unitário médio ponderado + quantidade total.
  const overall = useMemo(() => {
    return rangeMonths.map((mes, i, arr) => {
      const allEntries = MATERIALS.map((m) => m.months[mes]).filter(isValidEntry);
      const preco = weightedUnit(allEntries);
      const qtd = allEntries.reduce((s, e) => s + e.qtd, 0);
      const prevEntries =
        i > 0 ? MATERIALS.map((m) => m.months[arr[i - 1]]).filter(isValidEntry) : [];
      const prevPreco = prevEntries.length ? weightedUnit(prevEntries) : 0;
      const variacao = prevPreco ? ((preco - prevPreco) / prevPreco) * 100 : 0;
      return {
        mes,
        preco: Number(preco.toFixed(4)),
        qtd: Number(qtd.toFixed(2)),
        variacao: Number(variacao.toFixed(2)),
      };
    });
  }, [rangeMonths]);

  // KPIs baseados em preço unitário ponderado do período.
  const allValidInRange = useMemo(
    () =>
      rangeMonths.flatMap((mes) => MATERIALS.map((m) => m.months[mes]).filter(isValidEntry)),
    [rangeMonths],
  );
  const qtdMat = series.reduce((s, x) => s + x.qtd, 0);
  const precoMedio = weightedUnit(
    rangeMonths
      .map((mes) => material?.months[mes])
      .filter(isValidEntry),
  );
  const precoMedioGlobal = weightedUnit(allValidInRange);
  const varPrecoMaterial =
    series.length > 1 && series[0].preco
      ? ((series.at(-1)!.preco - series[0].preco) / series[0].preco) * 100
      : 0;

  // Ranking: variação % do preço unitário (último vs primeiro do período).
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
        atual: Number(atual.toFixed(4)),
        base: Number(base.toFixed(4)),
        variacao: Number(variacao.toFixed(2)),
      };
    })
      .filter((r) => r.atual > 0 && r.base > 0)
      .sort((a, b) => b.variacao - a.variacao);
  }, [rangeMonths]);

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
  };

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
                  Variação de Compras — Preço Unitário e Quantidade
                </h1>
                <p className="mt-2 text-sm text-foreground/85 md:text-base">
                  Análise baseada exclusivamente no preço unitário (R$/kg) e quantidade comprada
                  por matéria-prima e grupo de produto. Notas de remessa desconsideradas.
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
                label: "Preço médio /kg (material)",
                value: fmtBRL(precoMedio),
                delta: `${rangeMonths.length} meses`,
                up: true,
              },
              {
                label: "Variação preço unitário",
                value: fmtPct(varPrecoMaterial),
                delta: `${rangeMonths[0] ?? "—"} → ${rangeMonths.at(-1) ?? "—"}`,
                up: varPrecoMaterial >= 0,
              },
              {
                label: "Quantidade total (material)",
                value: fmtKg(qtdMat),
                delta: "comprada no período",
                up: true,
              },
              {
                label: "Preço médio /kg (global)",
                value: fmtBRL(precoMedioGlobal),
                delta: "ponderado",
                up: true,
              },
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

          {/* Preço unitário por Grupo — evolução mensal */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Preço Unitário por Grupo de Produto (R$/kg) — evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer>
                  <LineChart
                    data={grupoPrecoSeries}
                    margin={{ top: 10, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number, n: string) => [
                        v ? `R$ ${v.toFixed(4)} /kg` : "—",
                        n,
                      ]}
                      contentStyle={tooltipStyle}
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
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quantidade por Grupo — evolução mensal */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Quantidade Comprada por Grupo (kg) — evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer>
                  <LineChart
                    data={grupoQtdSeries}
                    margin={{ top: 10, right: 16, left: 8, bottom: 4 }}
                  >
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
                      formatter={(v: number, n: string) => [fmtKg(v), n]}
                      contentStyle={tooltipStyle}
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
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Variação % preço unitário por grupo no período (line sobre grupos ordenados) */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Variação % do Preço Unitário por Grupo — {rangeMonths[0] ?? "—"} →{" "}
                  {rangeMonths.at(-1) ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <LineChart data={grupoVar} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
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
                        `${v.toFixed(2)}% — R$ ${(p.payload?.base ?? 0).toFixed(4)} → R$ ${(p.payload?.atual ?? 0).toFixed(4)} /kg`,
                        "Variação preço",
                      ]}
                      contentStyle={tooltipStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="variacao"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Material selecionado: Preço unitário + Quantidade (dual axis line) */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  {material?.name} — Preço Unitário (R$/kg) e Quantidade (kg)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      yAxisId="preco"
                      orientation="left"
                      stroke="var(--color-primary)"
                      fontSize={12}
                      tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
                    />
                    <YAxis
                      yAxisId="qtd"
                      orientation="right"
                      stroke="var(--color-accent)"
                      fontSize={12}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(v: number, n: string) =>
                        n === "Preço /kg"
                          ? [`R$ ${v.toFixed(4)} /kg`, n]
                          : [fmtKg(v), n]
                      }
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="preco"
                      type="monotone"
                      dataKey="preco"
                      name="Preço /kg"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-primary)" }}
                    />
                    <Line
                      yAxisId="qtd"
                      type="monotone"
                      dataKey="qtd"
                      name="Quantidade"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-accent)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Variação % mês a mês — preço unitário e quantidade do material */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Variação % mês a mês — Preço Unitário e Quantidade ({material?.name})
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number, n: string) => [`${v.toFixed(2)}%`, n]}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="varPreco"
                      name="Var. % Preço /kg"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="varQtd"
                      name="Var. % Quantidade"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Compras totais por mês — preço médio ponderado + quantidade total */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Compras Totais por Mês (todos os materiais) — Preço médio /kg e Quantidade
                </CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer>
                  <LineChart data={overall} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="mes" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis
                      yAxisId="preco"
                      orientation="left"
                      stroke="var(--color-primary)"
                      fontSize={12}
                      tickFormatter={(v) => `R$ ${Number(v).toFixed(2)}`}
                    />
                    <YAxis
                      yAxisId="qtd"
                      orientation="right"
                      stroke="var(--color-accent)"
                      fontSize={12}
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : `${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(v: number, n: string) =>
                        n === "Preço médio /kg"
                          ? [`R$ ${v.toFixed(4)} /kg`, n]
                          : [fmtKg(v), n]
                      }
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="preco"
                      type="monotone"
                      dataKey="preco"
                      name="Preço médio /kg"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="qtd"
                      type="monotone"
                      dataKey="qtd"
                      name="Quantidade total"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Ranking — variação % preço unitário (line sobre materiais ordenados) */}
          <div className="mt-6 grid grid-cols-1 gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">
                  Ranking de Variação do Preço Unitário — {rangeMonths.at(-1) ?? "—"} vs{" "}
                  {rangeMonths[0] ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent style={{ height: Math.max(360, ranking.length * 14) }}>
                <ResponsiveContainer>
                  <LineChart
                    data={ranking}
                    margin={{ top: 20, right: 24, left: 8, bottom: 100 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--color-muted-foreground)"
                      fontSize={10}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(
                        v: number,
                        _n,
                        p: {
                          payload?: {
                            base?: number;
                            atual?: number;
                            grupo?: string;
                          };
                        },
                      ) => {
                        const d = p.payload ?? {};
                        return [
                          `${v.toFixed(2)}% — R$ ${(d.base ?? 0).toFixed(4)} → R$ ${(d.atual ?? 0).toFixed(4)} /kg`,
                          d.grupo ?? "Variação",
                        ];
                      }}
                      contentStyle={tooltipStyle}
                    />
                    <Line
                      type="monotone"
                      dataKey="variacao"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-primary)" }}
                    />
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

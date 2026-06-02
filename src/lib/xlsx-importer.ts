import * as XLSX from "xlsx";

export type MonthEntry = { vlr: number; qtd: number; unit: number };
export type Material = { name: string; grupo: string; months: Record<string, MonthEntry> };
export type Dataset = { months: string[]; materials: Material[] };

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const findKey = (row: Record<string, unknown>, candidates: string[]) => {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((k) => norm(k).includes(c));
    if (k) return k;
  }
  return null;
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};

const toMonthKey = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2]}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${m[2].padStart(2, "0")}/${yy}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  return null;
};

export async function parseEntradasXlsx(file: File): Promise<Dataset> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) throw new Error("Planilha vazia");

  const sample = rows[0];
  const kName = findKey(sample, ["material", "produto", "descric", "item", "insumo"]);
  const kGrupo = findKey(sample, ["grupo", "categoria", "familia", "classe"]);
  const kDate = findKey(sample, ["data", "mes", "emissao", "competen", "periodo"]);
  const kQtd = findKey(sample, ["quantidade", "qtd", "qtde", "kg"]);
  const kVlr = findKey(sample, ["valor", "vlr", "total", "preco total"]);
  const kTipo = findKey(sample, ["tipo", "operacao", "natureza", "documento", "especie"]);

  if (!kName || !kDate || !kQtd || !kVlr) {
    throw new Error(
      "Colunas obrigatórias não encontradas. Esperado: material, data, quantidade, valor.",
    );
  }

  const agg = new Map<string, Material>();
  const monthSet = new Set<string>();

  for (const row of rows) {
    if (kTipo) {
      const t = norm(row[kTipo]);
      if (t.includes("remessa") || t.includes("devolu")) continue;
    }
    const name = String(row[kName] ?? "").trim();
    if (!name) continue;
    const grupo = kGrupo ? String(row[kGrupo] ?? "").trim() || "OUTROS" : "OUTROS";
    const mes = toMonthKey(row[kDate]);
    if (!mes) continue;
    const qtd = toNumber(row[kQtd]);
    const vlr = toNumber(row[kVlr]);
    if (qtd <= 0 || vlr <= 0) continue;

    monthSet.add(mes);
    const key = `${name}__${grupo}`;
    let mat = agg.get(key);
    if (!mat) {
      mat = { name, grupo, months: {} };
      agg.set(key, mat);
    }
    const cur = mat.months[mes] ?? { vlr: 0, qtd: 0, unit: 0 };
    cur.vlr += vlr;
    cur.qtd += qtd;
    mat.months[mes] = cur;
  }

  for (const mat of agg.values()) {
    for (const mes of Object.keys(mat.months)) {
      const e = mat.months[mes];
      e.unit = e.qtd > 0 ? e.vlr / e.qtd : 0;
    }
  }

  const months = Array.from(monthSet).sort((a, b) => {
    const [ma, ya] = a.split("/").map(Number);
    const [mb, yb] = b.split("/").map(Number);
    return ya * 12 + ma - (yb * 12 + mb);
  });

  return {
    months,
    materials: Array.from(agg.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

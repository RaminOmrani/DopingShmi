/**
 * توکن‌ساز خالص فرمول و معادله‌ی شیمیایی برای نمایش (بدون React و بدون وابستگی؛ در سرور، کلاینت و تست قابل استفاده).
 *
 * قواعد نوشتن:
 * - عدد بعد از نماد عنصر، «)» یا «]» زیروند می‌شود: H2SO4، Ca(OH)2، K4[Fe(CN)6]
 * - عدد اول گونه ضریب است و هم‌اندازه می‌ماند: 2H2O، 1/2O2
 * - بالانویس با ^: SO4^2-، NH4^+، Fe^3+، Fe^{3+}، 10^-14 ؛ زیرنویس صریح با _: C_{n}H_{2n+2}، K_a
 * - «+» یا «-» تنها در انتهای گونه بار است: Na+، Cl-، NH4+ (بار چندتایی را همیشه با ^ بنویسید: Fe^3+ نه Fe3+)
 * - آب تبلور با «.»، «*» یا «·» نوشته و «·» نمایش داده می‌شود: CuSO4.5H2O
 * - الکترون: e^- یا e- ؛ حالت فیزیکی: (s) (l) (g) (aq)
 * - پیکان: -> یا → (یک‌طرفه)، <=> یا ⇌ (تعادلی)
 */

export type ChemToken =
  | { t: "el"; v: string }
  | { t: "sub"; v: string }
  | { t: "sup"; v: string }
  | { t: "coef"; v: string }
  | { t: "dot" }
  | { t: "state"; v: string }
  | { t: "e" }
  | { t: "arrow"; v: "→" | "⇌" | "←" }
  | { t: "plus" }
  | { t: "space" }
  | { t: "open"; v: string }
  | { t: "close"; v: string }
  | { t: "text"; v: string };

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const MINUS = "\u2212";

/** رقم فارسی/عربی → لاتین؛ منفی یونیکد → خط تیره (فقط برای تجزیه) */
export function normalizeChemInput(f: string): string {
  return f
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[\u2212\u2013]/g, "-")
    .replace(/\u00a0/g, " ");
}

const ARROWS: [RegExp, "→" | "⇌" | "←"][] = [
  [/^(<=>|<->|⇌|⇄)/, "⇌"],
  [/^(->|→|⟶|⟹)/, "→"],
  [/^(<-|←)/, "←"],
];
const ARROW_RE = /(<=>|<->|⇌|⇄|->|→|⟶|⟹|<-|←)/;

/** آیا متن پیکان واکنش دارد؟ (برای انتخاب Eq به‌جای Chem) */
export const hasArrow = (f: string) => ARROW_RE.test(f);

/** پس از این توکن‌ها عدد زیروند است */
const SUB_AFTER = new Set(["el", "close"]);
/** پس از این توکن‌ها «+»/«-» در انتهای گونه بار است */
const CHARGE_AFTER = new Set(["el", "sub", "close", "e"]);
/** شروع گونه (برای تشخیص الکترون) */
const SPECIES_START = new Set(["start", "space", "coef", "plus", "arrow", "dot", "open"]);

const signFix = (s: string) => s.replace(/-/g, MINUS);

/** فرمول یا معادله → توکن‌ها */
export function tokenizeChem(input: string): ChemToken[] {
  const f = normalizeChemInput(input);
  const out: ChemToken[] = [];
  let prev = "start";
  const push = (tok: ChemToken) => {
    const last = out[out.length - 1];
    if (tok.t === "text" && last?.t === "text") last.v += tok.v;
    else out.push(tok);
    prev = tok.t;
  };
  let i = 0;
  while (i < f.length) {
    const rest = f.slice(i);
    const ch = f[i];

    // فاصله
    const ws = /^\s+/.exec(rest);
    if (ws) {
      push({ t: "space" });
      i += ws[0].length;
      continue;
    }
    // پیکان
    const arrow = ARROWS.find(([re]) => re.test(rest));
    if (arrow) {
      push({ t: "arrow", v: arrow[1] });
      i += arrow[0].exec(rest)![0].length;
      continue;
    }
    // بالانویس ^…
    if (ch === "^") {
      const body = rest.slice(1);
      let v = "";
      let len = 1;
      if (body.startsWith("{")) {
        const end = body.indexOf("}");
        v = end > 0 ? body.slice(1, end) : body.slice(1);
        len += end > 0 ? end + 1 : body.length;
      } else {
        const m = /^[+-]?\d*(?:\.\d+)?[+-]?/.exec(body);
        v = m && m[0] ? m[0] : body.slice(0, 1);
        len += v.length;
      }
      if (v) push({ t: "sup", v: signFix(v) });
      i += len;
      continue;
    }
    // زیرنویس صریح _…
    if (ch === "_") {
      const body = rest.slice(1);
      let v = "";
      let len = 1;
      if (body.startsWith("{")) {
        const end = body.indexOf("}");
        v = end > 0 ? body.slice(1, end) : body.slice(1);
        len += end > 0 ? end + 1 : body.length;
      } else {
        const m = /^\d+/.exec(body);
        v = m ? m[0] : body.slice(0, 1);
        len += v.length;
      }
      if (v) push({ t: "sub", v: signFix(v) });
      i += len;
      continue;
    }
    // حالت فیزیکی یا پرانتز
    if (ch === "(") {
      const st = /^\((s|l|g|aq)\)/.exec(rest);
      if (st) {
        push({ t: "state", v: st[0] });
        i += st[0].length;
        continue;
      }
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      push({ t: "open", v: ch });
      i++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      push({ t: "close", v: ch });
      i++;
      continue;
    }
    // جداکننده‌ی آب تبلور
    if (ch === "·" || ch === "*" || ch === "•" || ch === "∙" || ch === "⋅") {
      push({ t: "dot" });
      i++;
      continue;
    }
    if (ch === "." && (prev === "el" || prev === "sub" || prev === "close") && /^[\dA-Z(xn]/.test(f[i + 1] ?? "")) {
      push({ t: "dot" });
      i++;
      continue;
    }
    // عدد: زیروند یا ضریب
    if (/\d/.test(ch)) {
      if (SUB_AFTER.has(prev)) {
        const m = /^\d+/.exec(rest)!;
        push({ t: "sub", v: m[0] });
        i += m[0].length;
      } else {
        const m = /^\d+(?:[./]\d+)?/.exec(rest)!;
        push({ t: "coef", v: m[0] });
        i += m[0].length;
      }
      continue;
    }
    // نماد عنصر
    const el = /^[A-Z][a-z]?/.exec(rest);
    if (el) {
      push({ t: "el", v: el[0] });
      i += el[0].length;
      continue;
    }
    // الکترون
    if (ch === "e" && SPECIES_START.has(prev) && /^(\^|-|⁻|\s|$)/.test(f.slice(i + 1) || "")) {
      push({ t: "e" });
      i++;
      continue;
    }
    // بار انتهایی یا علامت جمع
    if (ch === "+" || ch === "-") {
      const next = f.slice(i + 1);
      if (CHARGE_AFTER.has(prev) && (next === "" || /^(\s|\((s|l|g|aq)\)|[)\]])/.test(next))) {
        push({ t: "sup", v: ch === "-" ? MINUS : "+" });
        i++;
        continue;
      }
      if (ch === "+") {
        push({ t: "plus" });
        i++;
        continue;
      }
    }
    push({ t: "text", v: ch });
    i++;
  }
  return out;
}

export type EqPart = { kind: "species"; tokens: ChemToken[] } | { kind: "op"; token: ChemToken };

/**
 * گروه‌بندی برای نمایش معادله: هر گونه یک گروه (بدون شکستن خط) و «+»/پیکان جداکننده؛
 * فاصله‌های کنار جداکننده‌ها حذف می‌شوند چون جداکننده خودش با فاصله نمایش داده می‌شود.
 */
export function groupEq(tokens: ChemToken[]): EqPart[] {
  const parts: EqPart[] = [];
  let cur: ChemToken[] = [];
  const flush = () => {
    while (cur.length && cur[cur.length - 1].t === "space") cur.pop();
    while (cur.length && cur[0].t === "space") cur.shift();
    if (cur.length) parts.push({ kind: "species", tokens: cur });
    cur = [];
  };
  for (const tok of tokens) {
    if (tok.t === "plus" || tok.t === "arrow") {
      flush();
      parts.push({ kind: "op", token: tok });
    } else if (tok.t === "space") {
      // فاصله بین دو بخش یک گونه (مثل «2 H2O») حفظ می‌شود؛ فاصله‌ی کنار جداکننده در flush حذف می‌شود
      cur.push(tok);
    } else cur.push(tok);
  }
  flush();
  return parts;
}

const SUB_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", [MINUS]: "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", h: "ₕ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", p: "ₚ", s: "ₛ", t: "ₜ",
};
const SUP_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", [MINUS]: "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const mapChars = (s: string, m: Record<string, string>) => [...s].map((c) => m[c] ?? c).join("");

const OP_TEXT = (tok: ChemToken) => (tok.t === "arrow" ? ` ${tok.v} ` : tok.t === "plus" ? " + " : "");

/** توکن‌ها → متن ساده‌ی یونیکد (H₂SO₄، SO₄²⁻)؛ برای title، توضیح متا، JSON-LD و aria */
export function tokensToPlain(tokens: ChemToken[]): string {
  return groupEq(tokens)
    .map((p) =>
      p.kind === "op"
        ? OP_TEXT(p.token)
        : p.tokens
            .map((tok) => {
              switch (tok.t) {
                case "sub": return mapChars(tok.v, SUB_MAP);
                case "sup": return mapChars(tok.v, SUP_MAP);
                case "dot": return "·";
                case "e": return "e";
                case "space": return " ";
                case "plus": case "arrow": return OP_TEXT(tok);
                default: return tok.v;
              }
            })
            .join(""),
    )
    .join("");
}

/** فرمول → متن یونیکد: chemPlain("SO4^2-") → «SO₄²⁻» */
export const chemPlain = (f: string) => tokensToPlain(tokenizeChem(f));

export type ChemSegment =
  | { t: "text"; v: string }
  | { t: "chem"; v: string }
  | { t: "eq"; v: string }
  | { t: "bold"; children: ChemSegment[] };

/** فقط {{…}} را جدا می‌کند */
function splitFormulas(text: string): ChemSegment[] {
  const out: ChemSegment[] = [];
  const re = /\{\{([\s\S]+?)\}\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    const f = m[1].trim();
    out.push({ t: hasArrow(f) ? "eq" : "chem", v: f });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** متن ChemText → بخش‌ها: {{فرمول}} (یا معادله اگر پیکان دارد) و **پررنگ** (فرمول داخل پررنگ هم مجاز است) */
export function splitChemText(text: string): ChemSegment[] {
  const out: ChemSegment[] = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(...splitFormulas(text.slice(last, m.index)));
    out.push({ t: "bold", children: splitFormulas(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...splitFormulas(text.slice(last)));
  return out;
}

/**
 * متن ChemText → متن ساده (فرمول‌ها یونیکد، بدون **)؛ برای توضیح متا، عنوان و JSON-LD.
 * isolate: هر فرمول را با نویسه‌های نامرئی LRI…PDI جدا می‌کند (برای متن ساده‌ای که در محیط راست‌به‌چپ نمایش داده می‌شود).
 */
export function chemTextPlain(text: string, opts: { isolate?: boolean } = {}): string {
  const LRI = String.fromCharCode(0x2066);
  const PDI = String.fromCharCode(0x2069);
  const wrap = (v: string) => (opts.isolate ? LRI + v + PDI : v);
  const flat = (segs: ChemSegment[]): string =>
    segs.map((seg) => (seg.t === "text" ? seg.v : seg.t === "bold" ? flat(seg.children) : wrap(chemPlain(seg.v)))).join("");
  return flat(splitChemText(text));
}

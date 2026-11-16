/**
 * کسر گویای دقیق با BigInt (خالص و ایزومورفیک) برای حل دقیق دستگاه موازنه.
 * کسر همیشه ساده‌شده است و مخرج مثبت دارد.
 */

export const babs = (a: bigint) => (a < 0n ? -a : a);

/** بزرگ‌ترین مقسوم‌علیه مشترک (همیشه نامنفی) */
export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** کوچک‌ترین مضرب مشترک (نامنفی) */
export function blcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return babs((a / bgcd(a, b)) * b);
}

export class Frac {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new RangeError("مخرج صفر");
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = bgcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static readonly ZERO = new Frac(0n);
  static readonly ONE = new Frac(1n);

  static of(n: bigint | number, d: bigint | number = 1n) {
    return new Frac(n, d);
  }

  add(o: Frac) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac) {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac) {
    if (o.n === 0n) throw new RangeError("تقسیم بر صفر");
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Frac(-this.n, this.d);
  }
  isZero() {
    return this.n === 0n;
  }
  isInteger() {
    return this.d === 1n;
  }
  sign() {
    return this.n === 0n ? 0 : this.n > 0n ? 1 : -1;
  }
  eq(o: Frac) {
    return this.n === o.n && this.d === o.d;
  }
  cmp(o: Frac) {
    const x = this.n * o.d - o.n * this.d;
    return x === 0n ? 0 : x > 0n ? 1 : -1;
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  }
  toString() {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

/**
 * فرم سطری پلکانی کاهش‌یافته (RREF) به‌صورت دقیق.
 * خروجی: ماتریس جدید و ستون‌های محوری.
 */
export function rref(m: Frac[][]): { matrix: Frac[][]; pivots: number[] } {
  const a = m.map((r) => r.slice());
  const rows = a.length;
  const cols = rows ? a[0].length : 0;
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++)
      if (!a[i][c].isZero()) {
        p = i;
        break;
      }
    if (p < 0) continue;
    [a[r], a[p]] = [a[p], a[r]];
    const pv = a[r][c];
    a[r] = a[r].map((x) => x.div(pv));
    for (let i = 0; i < rows; i++) {
      if (i === r || a[i][c].isZero()) continue;
      const f = a[i][c];
      a[i] = a[i].map((x, j) => x.sub(f.mul(a[r][j])));
    }
    pivots.push(c);
    r++;
  }
  return { matrix: a, pivots };
}

/**
 * پایه‌ی فضای پوچ ماتریس (A·x = 0) با بردارهای گویای دقیق.
 * برای هر متغیر آزاد یک بردار: آن متغیر ۱، بقیه‌ی آزادها ۰.
 */
export function nullSpace(m: Frac[][]): Frac[][] {
  const cols = m.length ? m[0].length : 0;
  const { matrix, pivots } = rref(m);
  const free = [...Array(cols).keys()].filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const v = Array.from({ length: cols }, () => Frac.ZERO);
    v[f] = Frac.ONE;
    pivots.forEach((pc, row) => {
      v[pc] = matrix[row][f].neg();
    });
    return v;
  });
}

/** بردار گویا → کوچک‌ترین بردار صحیح هم‌جهت (ضرب در ک.م.م مخرج‌ها، تقسیم بر ب.م.م صورت‌ها) */
export function toSmallestIntegers(v: Frac[]): bigint[] {
  const l = v.reduce((acc, x) => blcm(acc, x.d), 1n);
  const ints = v.map((x) => (x.n * l) / x.d);
  const g = ints.reduce((acc, x) => bgcd(acc, x), 0n) || 1n;
  return ints.map((x) => x / g);
}

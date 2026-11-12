// Exact arithmetic and answer checking for junior-high calculation drills.

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

export class Frac {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      throw new Error("分數的分子分母必須是整數");
    }
    if (d === 0) throw new Error("分母不可為 0");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static from(n, d = 1) {
    return new Frac(n, d);
  }

  static get zero() {
    return new Frac(0, 1);
  }

  static get one() {
    return new Frac(1, 1);
  }

  isZero() {
    return this.n === 0;
  }

  isOne() {
    return this.n === 1 && this.d === 1;
  }

  isNegOne() {
    return this.n === -1 && this.d === 1;
  }

  isInt() {
    return this.d === 1;
  }

  eq(other) {
    return this.n === other.n && this.d === other.d;
  }

  cmp(other) {
    return this.n * other.d - other.n * this.d;
  }

  abs() {
    return new Frac(Math.abs(this.n), this.d);
  }

  neg() {
    return new Frac(-this.n, this.d);
  }

  add(other) {
    return new Frac(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  sub(other) {
    return new Frac(this.n * other.d - other.n * this.d, this.d * other.d);
  }

  mul(other) {
    return new Frac(this.n * other.n, this.d * other.d);
  }

  div(other) {
    if (other.n === 0) throw new Error("不可除以 0");
    return new Frac(this.n * other.d, this.d * other.n);
  }

  inv() {
    if (this.n === 0) throw new Error("0 沒有倒數");
    return new Frac(this.d, this.n);
  }

  pow(k) {
    if (!Number.isInteger(k)) throw new Error("指數必須是整數");
    if (k === 0) return Frac.one;
    if (k < 0) return this.inv().pow(-k);
    let n = 1;
    let d = 1;
    for (let i = 0; i < k; i++) {
      n *= this.n;
      d *= this.d;
      if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
        throw new Error("數字太大");
      }
    }
    return new Frac(n, d);
  }

  toLatex() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? "-" : "";
    return `${sign}\\dfrac{${Math.abs(this.n)}}{${this.d}}`;
  }

  toPlain() {
    if (this.d === 1) return String(this.n);
    return `${this.n}/${this.d}`;
  }
}

function simplifySqrtInt(n) {
  if (n < 0) throw new Error("根號裡不能是負數");
  if (n === 0) return { coef: 0, rad: 1 };
  let coef = 1;
  let x = n;
  let rad = 1;
  for (let p = 2; p * p <= x; p++) {
    let count = 0;
    while (x % p === 0) {
      x = Math.floor(x / p);
      count++;
    }
    if (count) {
      coef *= p ** Math.floor(count / 2);
      if (count % 2) rad *= p;
    }
  }
  if (x > 1) rad *= x;
  return { coef, rad };
}

function primesOf(n) {
  const primes = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    if (x % p === 0) {
      primes.push(p);
      while (x % p === 0) x = Math.floor(x / p);
    }
  }
  if (x > 1) primes.push(x);
  return primes;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (pivot < n && a[pivot][col].isZero()) pivot++;
    if (pivot === n) throw new Error("這個根式分母化不了，請改寫");
    if (pivot !== col) {
      const tmp = a[col];
      a[col] = a[pivot];
      a[pivot] = tmp;
    }
    const div = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] = a[col][j].div(div);
    for (let r = 0; r < n; r++) {
      if (r === col || a[r][col].isZero()) continue;
      const f = a[r][col];
      for (let j = col; j <= n; j++) a[r][j] = a[r][j].sub(f.mul(a[col][j]));
    }
  }
  return a.map((row) => row[n]);
}

export class Radical {
  constructor(entries) {
    this.terms = new Map();
    for (const [rad, coef] of entries) {
      if (!coef.isZero()) this.terms.set(rad, coef);
    }
  }

  static fromFrac(frac) {
    if (frac.isZero()) return new Radical([]);
    return new Radical([[1, frac]]);
  }

  static fromInt(n) {
    return Radical.fromFrac(new Frac(n, 1));
  }

  static sqrtInt(n) {
    if (n < 0) throw new Error("根號裡不能是負數");
    const { coef, rad } = simplifySqrtInt(n);
    if (coef === 0) return Radical.fromInt(0);
    return new Radical([[rad, new Frac(coef, 1)]]);
  }

  isZero() {
    return this.terms.size === 0;
  }

  isRational() {
    if (this.terms.size === 0) return true;
    if (this.terms.size > 1) return false;
    return this.terms.has(1);
  }

  rational() {
    if (!this.isRational()) return null;
    return this.terms.get(1) || Frac.zero;
  }

  neg() {
    return new Radical([...this.terms].map(([r, c]) => [r, c.neg()]));
  }

  add(other) {
    const out = new Map(this.terms);
    for (const [r, c] of other.terms) {
      const sum = (out.get(r) || Frac.zero).add(c);
      if (sum.isZero()) out.delete(r);
      else out.set(r, sum);
    }
    return new Radical(out);
  }

  sub(other) {
    return this.add(other.neg());
  }

  mul(other) {
    const out = new Map();
    for (const [r1, c1] of this.terms) {
      for (const [r2, c2] of other.terms) {
        const { coef, rad } = simplifySqrtInt(r1 * r2);
        const add = c1.mul(c2).mul(new Frac(coef, 1));
        const prev = out.get(rad) || Frac.zero;
        const sum = prev.add(add);
        if (sum.isZero()) out.delete(rad);
        else out.set(rad, sum);
      }
    }
    return new Radical(out);
  }

  scale(frac) {
    if (frac.isZero()) return Radical.fromInt(0);
    return new Radical([...this.terms].map(([r, c]) => [r, c.mul(frac)]));
  }

  pow(k) {
    if (!Number.isInteger(k)) throw new Error("指數必須是整數");
    if (k === 0) return Radical.fromInt(1);
    if (k < 0) return this.inv().pow(-k);
    let result = Radical.fromInt(1);
    let base = this;
    let e = k;
    while (e > 0) {
      if (e % 2 === 1) result = result.mul(base);
      e = Math.floor(e / 2);
      if (e) base = base.mul(base);
    }
    return result;
  }

  sqrt() {
    if (!this.isRational()) throw new Error("請先把根號裡化成整數或分數");
    const frac = this.rational();
    if (frac.n < 0) throw new Error("根號裡不能是負數");
    if (frac.isZero()) return Radical.fromInt(0);
    const { coef, rad } = simplifySqrtInt(frac.n * frac.d);
    return new Radical([[rad, new Frac(coef, frac.d)]]);
  }

  primes() {
    const set = new Set();
    for (const rad of this.terms.keys()) {
      if (rad === 1) continue;
      for (const p of primesOf(rad)) set.add(p);
    }
    return [...set].sort((a, b) => a - b);
  }

  inv() {
    if (this.isZero()) throw new Error("不可除以 0");
    if (this.isRational()) return Radical.fromFrac(this.rational().inv());
    const primes = this.primes();
    if (primes.length > 5) throw new Error("這個根式太複雜");
    let basis = [1];
    for (const p of primes) {
      const extra = basis.map((b) => b * p);
      basis = basis.concat(extra);
    }
    const index = new Map(basis.map((b, i) => [b, i]));
    const n = basis.length;
    const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => Frac.zero));
    for (let j = 0; j < n; j++) {
      const prod = this.mul(new Radical([[basis[j], Frac.one]]));
      for (const [rad, coef] of prod.terms) {
        const i = index.get(rad);
        if (i === undefined) throw new Error("無法有理化這個分母");
        matrix[i][j] = coef;
      }
    }
    const vector = basis.map((_, i) => (i === 0 ? Frac.one : Frac.zero));
    const coords = solveLinearSystem(matrix, vector);
    return new Radical(coords.map((c, i) => [basis[i], c]));
  }

  div(other) {
    return this.mul(other.inv());
  }

  eq(other) {
    if (this.terms.size !== other.terms.size) return false;
    for (const [r, c] of this.terms) {
      const o = other.terms.get(r);
      if (!o || !o.eq(c)) return false;
    }
    return true;
  }

  key() {
    return [...this.terms]
      .sort((a, b) => a[0] - b[0])
      .map(([r, c]) => `${r}:${c.n}/${c.d}`)
      .join("|");
  }

  toPlain() {
    if (this.isZero()) return "0";
    const terms = [...this.terms].sort((a, b) => a[0] - b[0]);
    let out = "";
    terms.forEach(([rad, coef], i) => {
      const neg = coef.n < 0;
      const abs = coef.abs();
      let body;
      if (rad === 1) body = abs.toPlain();
      else if (abs.isOne()) body = `√${rad}`;
      else if (abs.isInt()) body = `${abs.n}√${rad}`;
      else body = `(${abs.toPlain()})√${rad}`;
      if (i === 0) out += neg ? `-${body}` : body;
      else out += neg ? ` - ${body}` : ` + ${body}`;
    });
    return out;
  }

  toLatex() {
    if (this.isZero()) return "0";
    const terms = [...this.terms].sort((a, b) => a[0] - b[0]);
    let out = "";
    terms.forEach(([rad, coef], i) => {
      const neg = coef.n < 0;
      const abs = coef.abs();
      let body;
      if (rad === 1) body = abs.toLatex();
      else if (abs.isOne()) body = `\\sqrt{${rad}}`;
      else if (abs.isInt()) body = `${abs.n}\\sqrt{${rad}}`;
      else body = `${abs.toLatex()}\\sqrt{${rad}}`;
      if (i === 0) out += neg ? `-${body}` : body;
      else out += neg ? ` - ${body}` : ` + ${body}`;
    });
    return out;
  }
}

function keyOf(i, j) {
  return `${i},${j}`;
}

export class Poly {
  constructor(entries) {
    this.map = new Map();
    for (const [key, coef] of entries) {
      if (!coef.isZero()) this.map.set(key, coef);
    }
  }

  static const(frac) {
    if (frac.isZero()) return new Poly([]);
    return new Poly([[keyOf(0, 0), frac]]);
  }

  static fromInt(n) {
    return Poly.const(new Frac(n, 1));
  }

  static var(name) {
    if (name === "x") return new Poly([[keyOf(1, 0), Frac.one]]);
    if (name === "y") return new Poly([[keyOf(0, 1), Frac.one]]);
    throw new Error("多項式請用 x、y");
  }

  isZero() {
    return this.map.size === 0;
  }

  eq(other) {
    if (this.map.size !== other.map.size) return false;
    for (const [k, c] of this.map) {
      const o = other.map.get(k);
      if (!o || !o.eq(c)) return false;
    }
    return true;
  }

  terms() {
    return [...this.map].map(([key, coef]) => {
      const [i, j] = key.split(",").map(Number);
      return { i, j, coef };
    });
  }

  degree() {
    let m = -1;
    for (const { i, j } of this.terms()) m = Math.max(m, i + j);
    return m;
  }

  leadUnivariate() {
    let best = null;
    for (const term of this.terms()) {
      if (term.j !== 0) throw new Error("這裡只要含 x 的式子");
      if (!best || term.i > best.i) best = term;
    }
    return best;
  }

  neg() {
    return new Poly(this.terms().map((t) => [keyOf(t.i, t.j), t.coef.neg()]));
  }

  add(other) {
    const out = new Map(this.map);
    for (const [k, c] of other.map) {
      const sum = (out.get(k) || Frac.zero).add(c);
      if (sum.isZero()) out.delete(k);
      else out.set(k, sum);
    }
    return new Poly(out);
  }

  sub(other) {
    return this.add(other.neg());
  }

  scale(frac) {
    if (frac.isZero()) return Poly.fromInt(0);
    return new Poly(this.terms().map((t) => [keyOf(t.i, t.j), t.coef.mul(frac)]));
  }

  mul(other) {
    const out = new Map();
    for (const a of this.terms()) {
      for (const b of other.terms()) {
        const key = keyOf(a.i + b.i, a.j + b.j);
        const sum = (out.get(key) || Frac.zero).add(a.coef.mul(b.coef));
        if (sum.isZero()) out.delete(key);
        else out.set(key, sum);
      }
    }
    return new Poly(out);
  }

  pow(k) {
    if (!Number.isInteger(k) || k < 0) throw new Error("次方必須是非負整數");
    if (k === 0) return Poly.fromInt(1);
    let result = Poly.fromInt(1);
    let base = this;
    let e = k;
    while (e > 0) {
      if (e % 2 === 1) result = result.mul(base);
      e = Math.floor(e / 2);
      if (e) base = base.mul(base);
      if (result.degree() > 12) throw new Error("次方太高");
    }
    return result;
  }

  shiftX(k) {
    return new Poly(this.terms().map((t) => [keyOf(t.i + k, t.j), t.coef]));
  }

  rem(divisor) {
    if (divisor.isZero()) throw new Error("不可除以 0");
    const lead = divisor.leadUnivariate();
    let r = this;
    let guard = 0;
    while (!r.isZero()) {
      const top = r.leadUnivariate();
      if (top.i < lead.i) break;
      if (++guard > 24) throw new Error("除法失敗");
      const coef = top.coef.div(lead.coef);
      const sub = divisor.shiftX(top.i - lead.i).scale(coef);
      r = r.sub(sub);
    }
    return r;
  }

  toLatex() {
    if (this.isZero()) return "0";
    const terms = this.terms().sort((a, b) => b.i - a.i || b.j - a.j);
    let out = "";
    terms.forEach((term, index) => {
      const { i, j, coef } = term;
      const neg = coef.n < 0;
      const abs = coef.abs();
      const pieces = [];
      if (i === 0 && j === 0) pieces.push(abs.toLatex());
      else {
        if (!abs.isOne()) pieces.push(abs.toLatex());
        if (i === 1) pieces.push("x");
        else if (i > 1) pieces.push(`x^{${i}}`);
        if (j === 1) pieces.push("y");
        else if (j > 1) pieces.push(`y^{${j}}`);
      }
      const body = pieces.join("");
      if (index === 0) out += neg ? `-${body}` : body;
      else out += neg ? ` - ${body}` : ` + ${body}`;
    });
    return out;
  }

  toPlain() {
    if (this.isZero()) return "0";
    const terms = this.terms().sort((a, b) => b.i - a.i || b.j - a.j);
    let out = "";
    terms.forEach((term, index) => {
      const { i, j, coef } = term;
      const neg = coef.n < 0;
      const abs = coef.abs();
      const pieces = [];
      if (i === 0 && j === 0) pieces.push(abs.toPlain());
      else {
        if (!abs.isOne()) pieces.push(`(${abs.toPlain()})`.replace(/^\((-?\d+)\)$/, "$1"));
        if (i === 1) pieces.push("x");
        else if (i > 1) pieces.push(`x^${i}`);
        if (j === 1) pieces.push("y");
        else if (j > 1) pieces.push(`y^${j}`);
      }
      let body = pieces.join("");
      if (!abs.isOne() && !abs.isInt() && (i || j)) body = `(${abs.toPlain()})${pieces.slice(1).join("")}`;
      if (index === 0) out += neg ? `-${body}` : body;
      else out += neg ? ` - ${body}` : ` + ${body}`;
    });
    return out;
  }
}

function polyContent(poly) {
  let g = 0;
  for (const { coef } of poly.terms()) {
    if (coef.d !== 1) return null;
    g = gcd(g, Math.abs(coef.n));
  }
  return g;
}

function clearDenom(poly) {
  let lcm = 1;
  for (const { coef } of poly.terms()) lcm = (lcm / gcd(lcm, coef.d)) * coef.d;
  return poly.scale(new Frac(lcm, 1));
}

export function polyGcd(a, b) {
  let x = primitive(clearDenom(a));
  let y = primitive(clearDenom(b));
  let guard = 0;
  while (!y.isZero()) {
    if (++guard > 20) throw new Error("因式計算失敗");
    const r = primitive(clearDenom(x.rem(y)));
    x = y;
    y = r;
  }
  return x;
}

function exactQuotient(a, b) {
  if (b.isZero()) throw new Error("不可除以 0");
  const lead = b.leadUnivariate();
  let remainder = a;
  let quotient = Poly.fromInt(0);
  let guard = 0;
  while (!remainder.isZero()) {
    const top = remainder.leadUnivariate();
    if (top.i < lead.i) break;
    if (++guard > 24) throw new Error("除法失敗");
    const coef = top.coef.div(lead.coef);
    const shift = top.i - lead.i;
    quotient = quotient.add(Poly.var("x").pow(shift).scale(coef));
    remainder = remainder.sub(b.shiftX(shift).scale(coef));
  }
  if (!remainder.isZero()) throw new Error("除不盡");
  return quotient;
}

export function simplifyRational(num, den) {
  if (den.isZero()) throw new Error("分母為 0");
  let lcm = 1;
  for (const { coef } of [...num.terms(), ...den.terms()]) {
    lcm = (lcm / gcd(lcm, coef.d)) * coef.d;
  }
  let nextNum = num.scale(new Frac(lcm, 1));
  let nextDen = den.scale(new Frac(lcm, 1));
  const divisor = polyGcd(nextNum, nextDen);
  if (divisor.degree() > 0) {
    nextNum = exactQuotient(nextNum, divisor);
    nextDen = exactQuotient(nextDen, divisor);
  }
  const common = gcd(polyContent(nextNum), polyContent(nextDen));
  nextNum = nextNum.scale(new Frac(1, common));
  nextDen = nextDen.scale(new Frac(1, common));
  if (nextDen.leadUnivariate().coef.n < 0) {
    nextNum = nextNum.neg();
    nextDen = nextDen.neg();
  }
  return { num: nextNum, den: nextDen };
}

function primitive(poly) {
  if (poly.isZero()) return poly;
  const cleared = clearDenom(poly);
  const content = polyContent(cleared);
  let next = cleared.scale(new Frac(1, content));
  const lead = next.leadUnivariate();
  if (lead && lead.coef.n < 0) next = next.neg();
  return next;
}

export class Mono {
  constructor(coef, exps) {
    this.coef = coef;
    this.exps = new Map();
    if (!coef.isZero()) {
      for (const [name, exp] of exps) {
        if (exp !== 0) this.exps.set(name, exp);
      }
    }
  }

  static fromFrac(frac) {
    return new Mono(frac, []);
  }

  isZero() {
    return this.coef.isZero();
  }

  neg() {
    return new Mono(this.coef.neg(), this.exps);
  }

  mul(other) {
    const exps = new Map(this.exps);
    for (const [name, exp] of other.exps) {
      const sum = (exps.get(name) || 0) + exp;
      if (sum === 0) exps.delete(name);
      else exps.set(name, sum);
    }
    return new Mono(this.coef.mul(other.coef), exps);
  }

  div(other) {
    if (other.isZero()) throw new Error("不可除以 0");
    const exps = new Map(this.exps);
    for (const [name, exp] of other.exps) {
      const sum = (exps.get(name) || 0) - exp;
      if (sum === 0) exps.delete(name);
      else exps.set(name, sum);
    }
    return new Mono(this.coef.div(other.coef), exps);
  }

  pow(k) {
    if (!Number.isInteger(k)) throw new Error("指數必須是整數");
    if (k === 0) return Mono.fromFrac(Frac.one);
    const exps = new Map();
    for (const [name, exp] of this.exps) exps.set(name, exp * k);
    return new Mono(this.coef.pow(k), exps);
  }

  eq(other) {
    if (!this.coef.eq(other.coef)) return false;
    if (this.exps.size !== other.exps.size) return false;
    for (const [name, exp] of this.exps) {
      if (other.exps.get(name) !== exp) return false;
    }
    return true;
  }

  toPlain() {
    if (this.isZero()) return "0";
    const vars = [...this.exps].sort((a, b) => a[0].localeCompare(b[0]));
    const num = [];
    const den = [];
    for (const [name, exp] of vars) {
      const body = Math.abs(exp) === 1 ? name : `${name}^${Math.abs(exp)}`;
      if (exp > 0) num.push(body);
      else den.push(body);
    }
    const coef = this.coef;
    const coefAbs = coef.abs();
    let head = "";
    if (coef.n < 0) head = "-";
    const coefPlain = coefAbs.toPlain();
    const coefBody = coefAbs.isInt() || !num.length ? coefPlain : `(${coefPlain})`;
    let numer = "";
    if (!(coefAbs.isOne() && num.length)) numer += coefBody;
    numer += num.join("");
    if (!numer) numer = "1";
    if (!den.length) return head + numer;
    return `${head}${numer}/${den.join("")}`;
  }

  toLatex() {
    if (this.isZero()) return "0";
    const vars = [...this.exps].sort((a, b) => a[0].localeCompare(b[0]));
    const num = [];
    const den = [];
    const piece = (name, exp) => (exp === 1 ? name : `${name}^{${exp}}`);
    for (const [name, exp] of vars) {
      if (exp > 0) num.push(piece(name, exp));
      else den.push(piece(name, -exp));
    }
    const neg = this.coef.n < 0;
    const abs = this.coef.abs();
    const coefTex = abs.isOne() && num.length ? "" : abs.toLatex();
    const numer = `${coefTex}${num.join("")}` || "1";
    const body = den.length ? `\\dfrac{${numer}}{${den.join("")}}` : numer;
    return neg ? `-${body}` : body;
  }
}

const VAR_SET = new Set(["a", "b", "x", "y"]);

export function normalizeInput(input) {
  return String(input)
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48))
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[ｘＸ]/g, "x")
    .replace(/[ｙＹ]/g, "y")
    .replace(/[ａＡ]/g, "a")
    .replace(/[ｂＢ]/g, "b")
    .replace(/[×·∙⋅＊*]/g, "*")
    .replace(/[÷／]/g, "/")
    .replace(/[－−–—]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[＝]/g, "=")
    .replace(/[＞]/g, ">")
    .replace(/[＜]/g, "<")
    .replace(/[≧]/g, ">=")
    .replace(/[≦]/g, "<=")
    .replace(/根號/g, "√")
    .replace(/[，、]/g, ",")
    .replace(/(\d+)又(\d+\/\d+)/g, "($1+$2)")
    .replace(/\s+/g, "");
}

function tokenize(input) {
  const s = normalizeInput(input);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "√") {
      tokens.push({ t: "sqrt" });
      i++;
      continue;
    }
    if (s.startsWith("sqrt", i)) {
      tokens.push({ t: "sqrt" });
      i += 4;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ t: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      const name = ch.toLowerCase();
      if (!VAR_SET.has(name)) throw new Error("只能使用 a、b、x、y");
      tokens.push({ t: "var", v: name });
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (two === ">=" || two === "≥") {
      tokens.push({ t: "op", v: ">=" });
      i += two.length;
      continue;
    }
    if (two === "<=" || two === "≤") {
      tokens.push({ t: "op", v: "<=" });
      i += two.length;
      continue;
    }
    const one = {
      "+": "plus",
      "-": "minus",
      "*": "star",
      "/": "slash",
      "^": "pow",
      "(": "lpar",
      ")": "rpar",
      ",": "comma",
      "=": "eq",
      ">": "gt",
      "<": "lt",
    }[ch];
    if (!one) throw new Error("有讀不懂的符號");
    if (one === "gt" || one === "lt") tokens.push({ t: "op", v: ch });
    else tokens.push({ t: one });
    i++;
  }
  const out = [];
  const leftOk = (tok) => tok.t === "num" || tok.t === "var" || tok.t === "rpar";
  const rightOk = (tok) => tok.t === "num" || tok.t === "var" || tok.t === "lpar" || tok.t === "sqrt";
  for (let k = 0; k < tokens.length; k++) {
    if (k > 0 && leftOk(tokens[k - 1]) && rightOk(tokens[k])) {
      if (!(tokens[k - 1].t === "num" && tokens[k].t === "num")) out.push({ t: "star" });
    }
    out.push(tokens[k]);
  }
  return out;
}

export function parseTree(input) {
  const tokens = tokenize(input);
  if (!tokens.length) throw new Error("請先填答案");
  let p = 0;
  const peek = () => tokens[p];
  function eat(type) {
    if (peek()?.t === type) {
      p++;
      return true;
    }
    return false;
  }
  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().t === "plus" || peek().t === "minus")) {
      const op = tokens[p++].t;
      const right = parseTerm();
      left = { type: op === "plus" ? "add" : "sub", a: left, b: right };
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    while (peek() && (peek().t === "star" || peek().t === "slash")) {
      const op = tokens[p++].t;
      const right = parseUnary();
      left = { type: op === "star" ? "mul" : "div", a: left, b: right };
    }
    return left;
  }
  function parseUnary() {
    if (eat("plus")) return parseUnary();
    if (eat("minus")) return { type: "neg", a: parseUnary() };
    return parsePow();
  }
  function parsePow() {
    let left = parseSqrt();
    if (eat("pow")) {
      const exp = parseUnary();
      left = { type: "pow", a: left, b: exp };
    }
    return left;
  }
  function parseSqrt() {
    if (eat("sqrt")) return { type: "sqrt", a: parseSqrt() };
    return parsePrimary();
  }
  function parsePrimary() {
    if (eat("lpar")) {
      const expr = parseExpr();
      if (!eat("rpar")) throw new Error("少了右括號");
      return expr;
    }
    const tok = tokens[p++];
    if (!tok) throw new Error("算式不完整");
    if (tok.t === "num") {
      if (!/^\d*\.?\d+$/.test(tok.v) || tok.v === ".") throw new Error("數字格式不對");
      return { type: "num", v: tok.v };
    }
    if (tok.t === "var") return { type: "var", name: tok.v };
    throw new Error("算式不完整");
  }
  const tree = parseExpr();
  if (p !== tokens.length) throw new Error("後面還有多餘的符號");
  return tree;
}

function decimalToFrac(raw) {
  if (!raw.includes(".")) return new Frac(Number(raw), 1);
  const [a, b] = raw.split(".");
  const num = Number((a || "0") + b);
  const den = 10 ** b.length;
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) throw new Error("數字太長");
  return new Frac(num, den);
}

function evalRadical(node) {
  switch (node.type) {
    case "num":
      return Radical.fromFrac(decimalToFrac(node.v));
    case "var":
      throw new Error("這題答案是數字或根式，不要留未知數");
    case "add":
      return evalRadical(node.a).add(evalRadical(node.b));
    case "sub":
      return evalRadical(node.a).sub(evalRadical(node.b));
    case "mul":
      return evalRadical(node.a).mul(evalRadical(node.b));
    case "div":
      return evalRadical(node.a).div(evalRadical(node.b));
    case "neg":
      return evalRadical(node.a).neg();
    case "sqrt":
      return evalRadical(node.a).sqrt();
    case "pow": {
      const exp = evalRadical(node.b);
      if (!exp.isRational() || !exp.rational().isInt()) throw new Error("指數請寫整數");
      return evalRadical(node.a).pow(exp.rational().n);
    }
    default:
      throw new Error("格式不對");
  }
}

function evalPoly(node) {
  switch (node.type) {
    case "num":
      return Poly.const(decimalToFrac(node.v));
    case "var":
      return Poly.var(node.name);
    case "add":
      return evalPoly(node.a).add(evalPoly(node.b));
    case "sub":
      return evalPoly(node.a).sub(evalPoly(node.b));
    case "mul":
      return evalPoly(node.a).mul(evalPoly(node.b));
    case "div": {
      const den = evalPoly(node.b);
      if (den.isZero()) throw new Error("不可除以 0");
      if (den.degree() > 0) throw new Error("這題請展開成多項式，分母只能是數字");
      return evalPoly(node.a).scale(den.terms()[0].coef.inv());
    }
    case "neg":
      return evalPoly(node.a).neg();
    case "sqrt":
      throw new Error("這題答案不用根號");
    case "pow": {
      const exp = evalPoly(node.b);
      if (exp.degree() > 0) throw new Error("指數請寫整數");
      const value = exp.isZero() ? Frac.zero : exp.terms()[0].coef;
      if (!value.isInt() || value.n < 0) throw new Error("指數請寫非負整數");
      return evalPoly(node.a).pow(value.n);
    }
    default:
      throw new Error("格式不對");
  }
}

function evalMono(node) {
  switch (node.type) {
    case "num":
      return Mono.fromFrac(decimalToFrac(node.v));
    case "var":
      return new Mono(Frac.one, [[node.name, 1]]);
    case "mul":
      return evalMono(node.a).mul(evalMono(node.b));
    case "div":
      return evalMono(node.a).div(evalMono(node.b));
    case "neg":
      return evalMono(node.a).neg();
    case "pow": {
      const exp = evalMono(node.b);
      if (exp.exps.size || !exp.coef.isInt()) throw new Error("指數請寫整數");
      return evalMono(node.a).pow(exp.coef.n);
    }
    case "add":
    case "sub":
      throw new Error("這題答案是一項，請合併好再寫");
    case "sqrt":
      throw new Error("這題答案不用根號");
    default:
      throw new Error("格式不對");
  }
}

function evalRational(node) {
  const asRat = (value) => ({ num: value, den: Poly.fromInt(1) });
  switch (node.type) {
    case "num":
      return asRat(Poly.const(decimalToFrac(node.v)));
    case "var":
      return asRat(Poly.var(node.name));
    case "neg": {
      const v = evalRational(node.a);
      return { num: v.num.neg(), den: v.den };
    }
    case "add":
    case "sub": {
      const left = evalRational(node.a);
      const right = evalRational(node.b);
      const num =
        node.type === "add"
          ? left.num.mul(right.den).add(right.num.mul(left.den))
          : left.num.mul(right.den).sub(right.num.mul(left.den));
      return { num, den: left.den.mul(right.den) };
    }
    case "mul": {
      const left = evalRational(node.a);
      const right = evalRational(node.b);
      return { num: left.num.mul(right.num), den: left.den.mul(right.den) };
    }
    case "div": {
      const left = evalRational(node.a);
      const right = evalRational(node.b);
      if (right.num.isZero()) throw new Error("除數不可為 0");
      return { num: left.num.mul(right.den), den: left.den.mul(right.num) };
    }
    case "pow": {
      const base = evalRational(node.a);
      const expPoly = evalPoly(node.b);
      if (expPoly.degree() > 0) throw new Error("指數請寫整數");
      const exp = expPoly.isZero() ? Frac.zero : expPoly.terms()[0].coef;
      if (!exp.isInt()) throw new Error("指數請寫整數");
      if (exp.n >= 0) return { num: base.num.pow(exp.n), den: base.den.pow(exp.n) };
      if (base.num.isZero()) throw new Error("0 不能取負指數");
      return { num: base.den.pow(-exp.n), den: base.num.pow(-exp.n) };
    }
    case "sqrt":
      throw new Error("這題答案不用根號");
    default:
      throw new Error("格式不對");
  }
}

function rationalLowest(num, den) {
  if (den.isZero()) return false;
  let lcm = 1;
  for (const { coef } of [...num.terms(), ...den.terms()]) {
    lcm = (lcm / gcd(lcm, coef.d)) * coef.d;
  }
  const n = num.scale(new Frac(lcm, 1));
  const d = den.scale(new Frac(lcm, 1));
  if (polyGcd(n, d).degree() > 0) return false;
  const cn = polyContent(n);
  const cd = polyContent(d);
  return gcd(cn, cd) === 1;
}

function rationalsEqual(a, b) {
  return a.num.mul(b.den).sub(b.num.mul(a.den)).isZero();
}

function intExponent(node) {
  const poly = evalPoly(node);
  if (poly.degree() > 0) return null;
  const coef = poly.isZero() ? Frac.zero : poly.terms()[0].coef;
  if (!coef.isInt()) return null;
  return coef.n;
}

function splitFactors(node) {
  if (node.type === "mul") {
    const left = splitFactors(node.a);
    if (!left.ok) return left;
    const right = splitFactors(node.b);
    if (!right.ok) return right;
    return { ok: true, constants: left.constants.concat(right.constants), linears: left.linears.concat(right.linears) };
  }
  if (node.type === "pow") {
    const exp = intExponent(node.b);
    if (exp === null || exp < 1) return { ok: false, feedback: "因式分解請寫成整係數因式相乘。" };
    const base = splitFactors(node.a);
    if (!base.ok) return base;
    return {
      ok: true,
      constants: base.constants.flatMap((c) => Array(exp).fill(c)),
      linears: base.linears.flatMap((c) => Array(exp).fill(c)),
    };
  }
  if (node.type === "neg") {
    const inner = splitFactors(node.a);
    if (!inner.ok) return inner;
    return { ok: true, constants: [new Frac(-1, 1), ...inner.constants], linears: inner.linears };
  }
  let poly;
  try {
    poly = evalPoly(node);
  } catch (error) {
    return { ok: false, feedback: error.message };
  }
  const deg = poly.degree();
  if (deg <= 0) {
    const coef = poly.isZero() ? Frac.zero : poly.terms()[0].coef;
    return { ok: true, constants: [coef], linears: [] };
  }
  if (deg > 1) return { ok: false, feedback: "這個式子等於題目，但還沒分解完。" };
  const cleared = clearDenom(poly);
  const content = polyContent(cleared);
  if (content !== 1) return { ok: false, feedback: "公因數還沒提完。" };
  return { ok: true, constants: [], linears: [cleared] };
}

function fail(feedback) {
  return { ok: false, feedback };
}

function ok() {
  return { ok: true, feedback: "" };
}

function parseNumberExpr(input) {
  const tree = parseTree(input);
  const value = evalRadical(tree);
  if (!value.isRational()) throw new Error("這題答案是有理數，請化到沒有根號");
  return value.rational();
}

const NONE_WORDS = new Set(["無解", "無", "沒有解", "空集合", "無實數解", "none", "∅", "{}"]);

function flipOp(op) {
  return { ">": "<", "<": ">", ">=": "<=", "<=": ">=" }[op];
}

function parseHalf(input) {
  const s = normalizeInput(input).replace(/≥/g, ">=").replace(/≤/g, "<=");
  let match = s.match(/^x(>=|<=|>|<)(.+)$/);
  if (match) return { op: match[1], value: parseNumberExpr(match[2]) };
  match = s.match(/^(.+?)(>=|<=|>|<)x$/);
  if (match) return { op: flipOp(match[2]), value: parseNumberExpr(match[1]) };
  return null;
}

function parseBetween(input) {
  const s = normalizeInput(input).replace(/≥/g, ">=").replace(/≤/g, "<=");
  const match = s.match(/^(.+?)(>=|<=|>|<)x(>=|<=|>|<)(.+)$/);
  if (!match) return null;
  const leftValue = parseNumberExpr(match[1]);
  const rightValue = parseNumberExpr(match[4]);
  const bounds = [];
  const take = (number, op, side) => {
    if (side === "left") {
      if (op === "<" || op === "<=") bounds.push({ side: "lower", value: number, inclusive: op === "<=" });
      else bounds.push({ side: "upper", value: number, inclusive: op === ">=" });
    } else if (op === "<" || op === "<=") bounds.push({ side: "upper", value: rightValue, inclusive: op === "<=" });
    else bounds.push({ side: "lower", value: rightValue, inclusive: op === ">=" });
  };
  take(leftValue, match[2], "left");
  if (match[3] === "<" || match[3] === "<=") bounds.push({ side: "upper", value: rightValue, inclusive: match[3] === "<=" });
  else bounds.push({ side: "lower", value: rightValue, inclusive: match[3] === ">=" });
  const lower = bounds.filter((b) => b.side === "lower");
  const upper = bounds.filter((b) => b.side === "upper");
  if (lower.length !== 1 || upper.length !== 1) throw new Error("區間的不等號方向不對");
  return { lower: lower[0], upper: upper[0] };
}

function splitList(input) {
  return normalizeInput(input)
    .split(/,|或|\||;/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSci(input) {
  let s = normalizeInput(input).replace(/[{}]/g, "");
  s = s.replace(/×/g, "*");
  let match = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:\*10\^|e)([+-]?\d+)$/i);
  if (!match) return null;
  const mant = decimalToFrac(match[1].replace(/^\+/, ""));
  const exp = Number(match[2]);
  const value = mant.mul(new Frac(10, 1).pow(exp));
  const normalized = mant.abs().cmp(Frac.one) >= 0 && mant.abs().cmp(new Frac(10, 1)) < 0;
  return { mant, exp, value, normalized };
}

export function checkAnswer(answer, input) {
  const raw = String(input ?? "").trim();
  if (!raw) return fail("這題還沒填。");
  try {
    if (answer.kind === "none") {
      const word = raw.replace(/\s+/g, "");
      return NONE_WORDS.has(word) ? ok() : fail("若真的沒有解，答案寫「無解」。");
    }
    if (answer.kind === "number") {
      const stripped = raw.replace(/^[xX]\s*=\s*/, "");
      const value = parseNumberExpr(stripped);
      return value.eq(answer.value) ? ok() : fail("再算一次。分數請約到最簡。");
    }
    if (answer.kind === "pair") {
      let text = normalizeInput(raw).replace(/[()]/g, "");
      text = text.replace(/x=/g, "").replace(/y=/g, "");
      const parts = text.split(/,|或/).filter(Boolean);
      if (parts.length !== 2) return fail("請依序寫 x, y，例如 2, -1。");
      const x = parseNumberExpr(parts[0]);
      const y = parseNumberExpr(parts[1]);
      return x.eq(answer.x) && y.eq(answer.y) ? ok() : fail("再檢查消去或代入的符號。");
    }
    if (answer.kind === "ineq") {
      if (answer.between) {
        const got = parseBetween(raw);
        if (!got) return fail("區間請寫成 1 ≤ x ≤ 5 這種形式。");
        const same =
          got.lower.value.eq(answer.between.lower) &&
          got.upper.value.eq(answer.between.upper) &&
          got.lower.inclusive === answer.between.lowerInclusive &&
          got.upper.inclusive === answer.between.upperInclusive;
        return same ? ok() : fail("端點或等號再檢查。");
      }
      const got = parseHalf(raw);
      if (!got) return fail("請寫成 x > 3 或 x ≤ -1/2。");
      return got.op === answer.op && got.value.eq(answer.value) ? ok() : fail("不等號方向或端點還不對。負數係數要記得改向。");
    }
    if (answer.kind === "set") {
      const parts = splitList(raw.replace(/^[xX]\s*=\s*/, "").replace(/[xX]\s*=\s*/g, ""));
      if (!parts.length) return fail("有多個解時用逗號分開，例如 2, 5。");
      const got = parts.map((part) => evalRadical(parseTree(part)));
      if (got.length !== answer.values.length) return fail("解的個數不對。重根寫一次就好。");
      const used = new Set();
      for (const value of got) {
        const index = answer.values.findIndex((item, i) => !used.has(i) && item.eq(value));
        if (index < 0) return fail("還有解不對，開平方記得正負兩個。");
        used.add(index);
      }
      return ok();
    }
    if (answer.kind === "radical") {
      const got = evalRadical(parseTree(raw));
      return got.eq(answer.value) ? ok() : fail("再化簡一次。同類根式合併，分母要有理化。");
    }
    if (answer.kind === "poly") {
      const got = evalPoly(parseTree(raw));
      return got.eq(answer.poly) ? ok() : fail("展開後再合併同類項。");
    }
    if (answer.kind === "mono") {
      const got = evalMono(parseTree(raw));
      return got.eq(answer.mono) ? ok() : fail("指數相加、相乘時再檢查一次，負指數改寫到分母。");
    }
    if (answer.kind === "rational") {
      const got = evalRational(parseTree(raw));
      if (got.den.isZero()) return fail("分母不能是 0。");
      if (!rationalsEqual(got, answer.rational)) return fail("化簡結果還不對。");
      if (!rationalLowest(got.num, got.den)) return fail("式子的值對了，但還沒化成最簡。");
      return ok();
    }
    if (answer.kind === "factor") {
      const tree = parseTree(raw);
      const expanded = evalPoly(tree);
      if (!expanded.eq(answer.poly)) return fail("展開後和題目不同。");
      const parts = splitFactors(tree);
      if (!parts.ok) return fail(parts.feedback);
      if (!parts.linears.length) return fail("請寫成因式相乘。");
      return ok();
    }
    if (answer.kind === "sci") {
      const got = parseSci(raw);
      if (!got) return fail("請寫成 a×10^n，例如 3.2*10^5 或 3.2×10^-4。");
      if (!got.value.eq(answer.value)) return fail("數值還不對。");
      if (!got.normalized) return fail("數值對了，但係數 a 要滿足 1 ≤ |a| < 10。");
      return ok();
    }
    return fail("無法核對這個答案。");
  } catch (error) {
    return fail(error.message || "格式讀不太懂。");
  }
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function irand(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function nonzero(rng, lo, hi) {
  let n = 0;
  do {
    n = irand(rng, lo, hi);
  } while (n === 0);
  return n;
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function linLatex(a, b, v = "x") {
  let s = "";
  if (a !== 0) {
    if (a === 1) s = v;
    else if (a === -1) s = `-${v}`;
    else s = `${a}${v}`;
  }
  if (b !== 0) {
    if (!s) s = String(b);
    else s += b > 0 ? `+${b}` : String(b);
  }
  return s || "0";
}

export function fracLatex(n, d) {
  return new Frac(n, d).toLatex();
}

export function wrapNeg(n) {
  return n < 0 ? `(${n})` : String(n);
}

export function sciLatex(mant, exp) {
  const mantTex = String(mant).includes(".") ? mant : String(mant);
  return `${mantTex} \\times 10^{${exp}}`;
}

export function makeNumber(value) {
  const frac = value instanceof Frac ? value : new Frac(value, 1);
  return { kind: "number", value: frac, plain: frac.toPlain(), latex: frac.toLatex() };
}

export function makeRadical(value) {
  return { kind: "radical", value, plain: value.toPlain(), latex: value.toLatex() };
}

export function makePoly(poly) {
  return { kind: "poly", poly, plain: poly.toPlain(), latex: poly.toLatex() };
}

export function makeMono(mono) {
  return { kind: "mono", mono, plain: mono.toPlain(), latex: mono.toLatex() };
}

export function makeFactor(poly, plain, latex) {
  return { kind: "factor", poly, plain, latex };
}

export function makeRational(num, den, plain, latex) {
  return { kind: "rational", rational: { num, den }, plain, latex };
}

export function makeSci(value, plain, latex) {
  return { kind: "sci", value, plain, latex };
}

export function makePair(x, y) {
  const xf = x instanceof Frac ? x : new Frac(x, 1);
  const yf = y instanceof Frac ? y : new Frac(y, 1);
  return {
    kind: "pair",
    x: xf,
    y: yf,
    plain: `${xf.toPlain()}, ${yf.toPlain()}`,
    latex: `\\left(${xf.toLatex()}, ${yf.toLatex()}\\right)`,
  };
}

export function makeIneq(op, value) {
  const frac = value instanceof Frac ? value : new Frac(value, 1);
  const symbol = { ">": ">", ">=": "\\ge", "<": "<", "<=": "\\le" }[op];
  const plainOp = { ">": ">", ">=": "≥", "<": "<", "<=": "≤" }[op];
  return {
    kind: "ineq",
    op,
    value: frac,
    plain: `x ${plainOp} ${frac.toPlain()}`,
    latex: `x ${symbol} ${frac.toLatex()}`,
  };
}

export function makeBetween(lower, upper, lowerInclusive, upperInclusive) {
  const lo = lower instanceof Frac ? lower : new Frac(lower, 1);
  const hi = upper instanceof Frac ? upper : new Frac(upper, 1);
  const left = lowerInclusive ? "≤" : "<";
  const right = upperInclusive ? "≤" : "<";
  const leftTex = lowerInclusive ? "\\le" : "<";
  const rightTex = upperInclusive ? "\\le" : "<";
  return {
    kind: "ineq",
    between: { lower: lo, upper: hi, lowerInclusive, upperInclusive },
    plain: `${lo.toPlain()} ${left} x ${right} ${hi.toPlain()}`,
    latex: `${lo.toLatex()} ${leftTex} x ${rightTex} ${hi.toLatex()}`,
  };
}

export function makeSet(values) {
  const radicals = values.map((value) => (value instanceof Radical ? value : Radical.fromFrac(value instanceof Frac ? value : new Frac(value, 1))));
  const plain = radicals.map((value) => value.toPlain()).join(", ");
  const latex =
    radicals.length === 1
      ? `x = ${radicals[0].toLatex()}`
      : radicals.map((value) => `x = ${value.toLatex()}`).join(" \\text{ 或 } ");
  return { kind: "set", values: radicals, plain, latex };
}

export function makeNone() {
  return { kind: "none", plain: "無解", latex: "\\text{無解}" };
}

export function problem(spec) {
  const answer = spec.answer;
  const self = checkAnswer(answer, answer.plain);
  if (!self.ok) return null;
  return spec;
}

export function decentNumber(frac, denLimit = 80, numLimit = 400) {
  return frac.d <= denLimit && Math.abs(frac.n) <= numLimit;
}

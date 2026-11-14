import {
  Frac,
  Mono,
  Poly,
  Radical,
  checkAnswer,
  decentNumber,
  fracLatex,
  hashString,
  irand,
  linLatex,
  makeBetween,
  makeFactor,
  makeIneq,
  makeMono,
  makeNone,
  makeNumber,
  makePair,
  makePoly,
  makeRadical,
  makeRational,
  makeSci,
  makeSet,
  mulberry32,
  nonzero,
  pick,
  problem,
  simplifyRational,
  gcd,
} from "./engine.js";

export const DIFFICULTY_LABEL = { basic: "基礎", medium: "中等", advanced: "進階" };

export const PLAN = [
  ["basic", 0],
  ["basic", 1],
  ["medium", 0],
  ["medium", 1],
  ["medium", 2],
  ["medium", 3],
  ["medium", 4],
  ["medium", 5],
  ["advanced", 0],
  ["advanced", 1],
];

const OPS = [">", ">=", "<", "<="];

function opLatex(op) {
  return { ">": ">", ">=": "\\ge", "<": "<", "<=": "\\le" }[op];
}

function flipOp(op) {
  return { ">": "<", "<": ">", ">=": "<=", "<=": ">=" }[op];
}

function lcm(a, b) {
  return Math.abs((a / gcd(a, b)) * b);
}

function emit(difficulty, prompt, stem, answer, steps) {
  if (!stem || !answer || !steps?.length) return null;
  return problem({ difficulty, prompt, stem, answer, steps });
}

function numQ(difficulty, stem, frac, steps, denLimit = 60, numLimit = 300) {
  if (!(frac instanceof Frac)) frac = new Frac(frac, 1);
  if (!decentNumber(frac, denLimit, numLimit)) return null;
  return emit(difficulty, "計算", stem, makeNumber(frac), steps);
}

function lin(variable, coef, constant) {
  let poly = Poly.fromInt(constant);
  if (coef) poly = poly.add(Poly.var(variable).scale(new Frac(coef, 1)));
  return poly;
}

function showInt(n, paren = false) {
  if (n < 0 && paren) return `(${n})`;
  return String(n);
}

function plusTex(left, right) {
  const sum = left.add(right);
  if (right.n < 0) return `${left.toLatex()} - ${right.abs().toLatex()} = ${sum.toLatex()}`;
  return `${left.toLatex()} + ${right.toLatex()} = ${sum.toLatex()}`;
}

function coefTimes(k, inner) {
  if (k === 1) return inner;
  if (k === -1) return `-${inner}`;
  if (k < 0) return `(${k})${inner}`;
  return `${k}${inner}`;
}

function parenLin(coef, constant, variable = "x") {
  return `\\left(${linLatex(coef, constant, variable)}\\right)`;
}

function decentRadical(value) {
  if (value.terms.size > 4) return false;
  for (const coef of value.terms.values()) {
    if (coef.d > 24 || Math.abs(coef.n) > 48) return false;
  }
  return true;
}

function decimalPlain(frac) {
  if (frac.isInt()) return String(frac.n);
  let d = frac.d;
  let twos = 0;
  let fives = 0;
  while (d % 2 === 0) {
    d = Math.floor(d / 2);
    twos++;
  }
  while (d % 5 === 0) {
    d = Math.floor(d / 5);
    fives++;
  }
  if (d !== 1) return null;
  const digits = Math.max(twos, fives);
  if (digits > 6) return null;
  const scaled = frac.mul(new Frac(10 ** digits, 1));
  if (!scaled.isInt()) return null;
  const digitsText = Math.abs(scaled.n).toString().padStart(digits + 1, "0");
  const intPart = digitsText.slice(0, digitsText.length - digits);
  const dec = digitsText.slice(digitsText.length - digits).replace(/0+$/, "");
  const sign = frac.n < 0 ? "-" : "";
  return dec ? `${sign}${intPart}.${dec}` : `${sign}${intPart}`;
}

function fracFromDecimal(text) {
  const [whole, dec = ""] = String(text).split(".");
  return new Frac(Number(`${whole}${dec}`), 10 ** dec.length);
}

function handSci(sci) {
  if (!sci || /\*10\^0$/.test(sci.plain)) return null;
  const decimals = sci.plain.split("*")[0].split(".")[1] || "";
  if (decimals.length > 2) return null;
  return sci;
}

function normalizeSci(value) {
  if (!(value instanceof Frac) || value.isZero() || value.n < 0) return null;
  let exp = 0;
  let mant = value;
  const ten = new Frac(10, 1);
  let guard = 0;
  while (mant.cmp(ten) >= 0) {
    mant = mant.div(ten);
    exp++;
    if (++guard > 24) return null;
  }
  while (mant.cmp(Frac.one) < 0) {
    mant = mant.mul(ten);
    exp--;
    if (++guard > 48) return null;
  }
  const mantText = decimalPlain(mant);
  if (!mantText) return null;
  return {
    value,
    plain: `${mantText}*10^${exp}`,
    latex: `${mantText} \\times 10^{${exp}}`,
  };
}

function sciValue(mantText, exp) {
  return fracFromDecimal(mantText).mul(new Frac(10, 1).pow(exp));
}

function ratAnswer(num, den) {
  const simplified = simplifyRational(num, den);
  const plain = simplified.den.eq(Poly.fromInt(1))
    ? simplified.num.toPlain()
    : `(${simplified.num.toPlain()})/(${simplified.den.toPlain()})`;
  const latex = simplified.den.eq(Poly.fromInt(1))
    ? simplified.num.toLatex()
    : `\\dfrac{${simplified.num.toLatex()}}{${simplified.den.toLatex()}}`;
  return makeRational(simplified.num, simplified.den, plain, latex);
}

function factorAnswer(poly, plain, latex) {
  if (poly.degree() < 1) return null;
  return makeFactor(poly, plain, latex);
}

function linearPlain(coef, constant, variable = "x") {
  if (constant === 0) {
    if (coef === 1) return variable;
    if (coef === -1) return `-${variable}`;
    return `${coef}${variable}`;
  }
  return `(${linLatex(coef, constant, variable)})`;
}

function linearLatex(coef, constant, variable = "x") {
  return `\\left(${linLatex(coef, constant, variable)}\\right)`;
}

function factorTex(coef, constant, variable = "x") {
  if (constant === 0) {
    if (coef === 1) return variable;
    if (coef === -1) return `-${variable}`;
    return `${coef}${variable}`;
  }
  return linearLatex(coef, constant, variable);
}

function randPrimitive(rng, variable = "x", coefMax = 4, constMax = 7) {
  const coef = irand(rng, 1, coefMax);
  const constant = irand(rng, -constMax, constMax);
  const g = gcd(coef, Math.abs(constant));
  const p = coef / g;
  const q = constant / g;
  return { p, q, poly: lin(variable, p, q) };
}

function uniqueRadicals(values) {
  const kept = [];
  for (const value of values) {
    if (!kept.some((item) => item.eq(value))) kept.push(value);
  }
  kept.sort((a, b) => approx(a) - approx(b));
  return kept;
}

function approx(radical) {
  let sum = 0;
  for (const [rad, coef] of radical.terms) sum += (coef.n / coef.d) * Math.sqrt(rad);
  return sum;
}

function quadFromRoots(a, root1, root2) {
  // a(x-r1)(x-r2) with rational roots stored as Frac
  const sum = root1.add(root2).neg();
  const prod = root1.mul(root2);
  let poly = Poly.var("x").pow(2).scale(new Frac(a, 1));
  poly = poly.add(Poly.var("x").scale(new Frac(a, 1).mul(sum)));
  poly = poly.add(Poly.const(new Frac(a, 1).mul(prod)));
  return poly;
}

function evalAtFrac(poly, x) {
  let sum = Frac.zero;
  for (const term of poly.terms()) {
    if (term.j !== 0) return null;
    sum = sum.add(term.coef.mul(x.pow(term.i)));
  }
  return sum;
}

function plugQuadRadical(a, b, c, root) {
  const value = root.pow(2).scale(new Frac(a, 1)).add(root.scale(new Frac(b, 1))).add(Radical.fromInt(c));
  return value.isZero();
}

function solveIneq(a, b, c, d, op) {
  const coef = a - c;
  const right = d - b;
  if (coef === 0) return null;
  const out = coef < 0 ? flipOp(op) : op;
  return { op: out, value: new Frac(right, coef), coef, right };
}

function solveFractionIneq(terms, rhs, op) {
  let coef = Frac.zero;
  let constant = Frac.zero;
  for (const term of terms) {
    coef = coef.add(new Frac(term.a, term.c));
    constant = constant.add(new Frac(term.b, term.c));
  }
  if (coef.isZero()) return null;
  const right = rhs.sub(constant);
  const out = coef.n < 0 ? flipOp(op) : op;
  return { op: out, value: right.div(coef), coef, constant, right };
}

function absSolutions(a, b, k) {
  if (a === 0 || k < 0) return null;
  const roots = [new Frac(k - b, a), new Frac(-k - b, a)];
  const ok = roots.every((x) => x.mul(new Frac(a, 1)).add(new Frac(b, 1)).abs().eq(new Frac(k, 1)));
  return ok ? roots : null;
}

function absPairSolutions(a, b, c, d) {
  if (a === c && b === d) return null;
  if (a === -c && b === -d) return null;
  const roots = [];
  if (a !== c) roots.push(new Frac(d - b, a - c));
  if (a + c !== 0) roots.push(new Frac(-d - b, a + c));
  if (!roots.length) return null;
  const ok = roots.every((x) => {
    const left = x.mul(new Frac(a, 1)).add(new Frac(b, 1)).abs();
    const right = x.mul(new Frac(c, 1)).add(new Frac(d, 1)).abs();
    return left.eq(right);
  });
  return ok ? roots : null;
}

function absSumAnswer(a, b, c) {
  if (a === b || c <= 0) return null;
  if (a > b) [a, b] = [b, a];
  const distance = b - a;
  if (c < distance) return makeNone();
  if (c === distance) return makeBetween(a, b, true, true);
  const left = new Frac(a + b - c, 2);
  const right = new Frac(a + b + c, 2);
  const check = (x) => x.sub(new Frac(a, 1)).abs().add(x.sub(new Frac(b, 1)).abs()).eq(new Frac(c, 1));
  if (!check(left) || !check(right)) return null;
  if (check(left.sub(Frac.one)) || check(right.add(Frac.one))) return null;
  return makeSet([Radical.fromFrac(left), Radical.fromFrac(right)]);
}

const MANTS = ["1.2", "1.5", "2", "2.4", "2.5", "3", "3.2", "4", "4.5", "5", "6", "6.4", "7.5", "8"];

function intfrac() {
  function signedProduct(rng) {
    const p = irand(rng, -9, 9);
    const q = nonzero(rng, -8, 8);
    const r = nonzero(rng, -8, 8);
    const prod = new Frac(q * r, 1);
    const value = new Frac(p, 1).add(prod);
    const stem = `${showInt(p)} + ${showInt(q, true)} \\times ${showInt(r, true)}`;
    return numQ("basic", stem, value, [
      { t: "先乘除，後加減。" },
      { m: `${showInt(q, true)} \\times ${showInt(r, true)} = ${prod.toLatex()}` },
      { m: plusTex(new Frac(p, 1), prod) },
    ]);
  }

  function fractionAdd(rng) {
    const d1 = irand(rng, 2, 8);
    const d2 = irand(rng, 2, 8);
    if (d1 === d2) return null;
    const n1 = nonzero(rng, -4, 4);
    const n2 = nonzero(rng, -4, 4);
    const left = new Frac(n1, d1);
    const right = new Frac(n2, d2);
    const value = left.add(right);
    return numQ("basic", `${left.toLatex()} + ${right.n < 0 ? `\\left(${right.toLatex()}\\right)` : right.toLatex()}`, value, [
      { t: "通分後再加減，最後約分。" },
      { m: plusTex(left, right) },
    ]);
  }

  function powerTrap(rng) {
    const n = irand(rng, 2, 9);
    const wrapped = rng() < 0.5;
    const value = wrapped ? new Frac(n * n, 1) : new Frac(-(n * n), 1);
    const stem = wrapped ? `\\left(-${n}\\right)^{2}` : `-${n}^{2}`;
    return numQ("basic", stem, value, [
      { t: wrapped ? "括號裡的負號一起被平方，結果是正的。" : "沒有括號時，次方只作用在數字上，負號最後才加上。" },
      { m: `${stem} = ${value.toLatex()}` },
    ]);
  }

  function integerMix(rng) {
    const a = nonzero(rng, -12, 12);
    const b = pick(rng, [-4, -3, -2, 2, 3, 4, 5, 6]);
    if (a % b !== 0) return null;
    const c = nonzero(rng, -6, 6);
    const d = nonzero(rng, -6, 6);
    const quot = new Frac(a / b, 1);
    const prod = new Frac(c * d, 1);
    const value = quot.sub(prod);
    const stem = `${showInt(a, true)} \\div ${showInt(b, true)} - ${showInt(c, true)} \\times ${showInt(d, true)}`;
    return numQ("medium", stem, value, [
      { t: "由左到右先做除法，再做乘法，最後才相減。" },
      { m: `${showInt(a, true)} \\div ${showInt(b, true)} = ${quot.toLatex()}` },
      { m: `${showInt(c, true)} \\times ${showInt(d, true)} = ${prod.toLatex()}` },
      { m: `${quot.toLatex()} - ${prod.n < 0 ? `\\left(${prod.toLatex()}\\right)` : prod.toLatex()} = ${value.toLatex()}` },
    ]);
  }

  function fractionMulDiv(rng) {
    const a = new Frac(nonzero(rng, -5, 5), irand(rng, 2, 6));
    const b = new Frac(nonzero(rng, -5, 5), irand(rng, 2, 6));
    const c = new Frac(nonzero(rng, -4, 4), irand(rng, 2, 5));
    const value = a.mul(b).div(c);
    const stem = `${a.toLatex()} \\times ${b.toLatex()} \\div ${c.n < 0 ? `\\left(${c.toLatex()}\\right)` : c.toLatex()}`;
    return numQ("medium", stem, value, [
      { t: "除以一個分數，就是乘上它的倒數。先約分再乘。" },
      { m: `${a.toLatex()} \\times ${b.toLatex()} = ${a.mul(b).toLatex()}` },
      { m: `${a.mul(b).toLatex()} \\div ${c.toLatex()} = ${value.toLatex()}` },
    ]);
  }

  function bracketTimes(rng) {
    const left = new Frac(1, irand(rng, 2, 5));
    const right = new Frac(1, irand(rng, left.d + 1, 8));
    const k = pick(rng, [6, 8, 12, 18, 24]);
    const diff = left.sub(right);
    const extra = new Frac(nonzero(rng, -3, 3), irand(rng, 2, 4));
    const value = diff.mul(new Frac(k, 1)).add(extra);
    const stem = `\\left(${left.toLatex()} - ${right.toLatex()}\\right) \\times ${k} + ${extra.n < 0 ? `\\left(${extra.toLatex()}\\right)` : extra.toLatex()}`;
    return numQ("medium", stem, value, [
      { t: "先算括號，再乘，最後加。" },
      { m: `${left.toLatex()} - ${right.toLatex()} = ${diff.toLatex()}` },
      { m: `${diff.toLatex()} \\times ${k} = ${diff.mul(new Frac(k, 1)).toLatex()}` },
      { m: plusTex(diff.mul(new Frac(k, 1)), extra) },
    ]);
  }

  function mixedPowers(rng) {
    const a = irand(rng, 2, 6);
    const b = irand(rng, 2, 4);
    const c = pick(rng, [-3, -2, 2, 3, 4]);
    const first = new Frac(-(a * a), 1);
    const second = new Frac((-b) ** 3 * c, 1);
    const value = first.add(second);
    const stem = `-${a}^{2} + \\left(-${b}\\right)^{3} \\times ${showInt(c, true)}`;
    return numQ("medium", stem, value, [
      { t: "沒有括號的次方不含負號；有括號時，負數一起次方。" },
      { m: `-${a}^{2} = ${first.toLatex()}` },
      { m: `\\left(-${b}\\right)^{3} \\times ${showInt(c, true)} = ${second.toLatex()}` },
      { m: plusTex(first, second) },
    ]);
  }

  function complexFraction(rng) {
    const a = new Frac(1, irand(rng, 2, 5));
    const b = new Frac(1, irand(rng, 3, 7));
    if (a.eq(b)) return null;
    const den = new Frac(1, irand(rng, 2, 8));
    const top = a.add(b);
    const value = top.div(den);
    const stem = `\\dfrac{${a.toLatex()} + ${b.toLatex()}}{${den.toLatex()}}`;
    return numQ("medium", stem, value, [
      { t: "繁分數先算分子、分母，再相除。" },
      { m: `${a.toLatex()} + ${b.toLatex()} = ${top.toLatex()}` },
      { m: `${top.toLatex()} \\div ${den.toLatex()} = ${value.toLatex()}` },
    ]);
  }

  function squareThenDivide(rng) {
    const n = pick(rng, [2, 3, 4]);
    const d = pick(rng, [3, 5, 7]);
    const base = new Frac(n, d).neg();
    const squared = base.pow(2);
    const divisor = squared;
    const extra = new Frac(irand(rng, -4, 4), 1);
    const value = squared.div(divisor).add(extra);
    if (extra.isZero()) return null;
    const stem = `\\left(${base.toLatex()}\\right)^{2} \\div ${divisor.toLatex()} + ${showInt(extra.n, true)}`;
    return numQ("medium", stem, value, [
      { t: "負分數的平方是正的。先平方，再除。" },
      { m: `\\left(${base.toLatex()}\\right)^{2} = ${squared.toLatex()}` },
      { m: `${squared.toLatex()} \\div ${divisor.toLatex()} = 1` },
      { m: plusTex(Frac.one, extra) },
    ]);
  }

  function nested(rng) {
    const a = new Frac(nonzero(rng, -3, 3), pick(rng, [2, 3, 4]));
    const b = new Frac(nonzero(rng, -3, 3), pick(rng, [2, 3, 5]));
    const c = new Frac(nonzero(rng, -4, 4), pick(rng, [2, 3, 4, 5]));
    const d = new Frac(nonzero(rng, -3, 3), pick(rng, [2, 3]));
    const inner = a.pow(2).sub(b);
    if (inner.isZero()) return null;
    const quot = inner.div(c);
    const value = quot.add(d);
    const stem = `\\left[\\left(${a.toLatex()}\\right)^{2} - ${b.n < 0 ? `\\left(${b.toLatex()}\\right)` : b.toLatex()}\\right] \\div ${c.n < 0 ? `\\left(${c.toLatex()}\\right)` : c.toLatex()} + ${d.n < 0 ? `\\left(${d.toLatex()}\\right)` : d.toLatex()}`;
    return numQ("advanced", stem, value, [
      { t: "由內往外：先處理次方和括號，再除，最後加。" },
      { m: `\\left(${a.toLatex()}\\right)^{2} = ${a.pow(2).toLatex()}` },
      { m: `${a.pow(2).toLatex()} - ${b.n < 0 ? `\\left(${b.toLatex()}\\right)` : b.toLatex()} = ${inner.toLatex()}` },
      { m: `${inner.toLatex()} \\div ${c.toLatex()} = ${quot.toLatex()}` },
      { m: plusTex(quot, d) },
    ], 80, 400);
  }

  function doubleComplex(rng) {
    const a = new Frac(1, pick(rng, [2, 3, 4]));
    const b = new Frac(1, pick(rng, [3, 5, 6]));
    const c = new Frac(1, pick(rng, [2, 3, 4]));
    const d = new Frac(1, pick(rng, [2, 5, 8]));
    const leftDen = a.add(b);
    const rightDen = c.sub(d);
    if (leftDen.isZero() || rightDen.isZero()) return null;
    const left = leftDen.inv();
    const right = rightDen.inv();
    const value = left.sub(right);
    const stem = `\\dfrac{1}{${a.toLatex()} + ${b.toLatex()}} - \\dfrac{1}{${c.toLatex()} - ${d.toLatex()}}`;
    return numQ("advanced", stem, value, [
      { t: "小分數的和差先算完，再取倒數。" },
      { m: `${a.toLatex()} + ${b.toLatex()} = ${leftDen.toLatex()}` },
      { m: `\\dfrac{1}{${leftDen.toLatex()}} = ${left.toLatex()}` },
      { m: `${c.toLatex()} - ${d.toLatex()} = ${rightDen.toLatex()}` },
      { m: `\\dfrac{1}{${rightDen.toLatex()}} = ${right.toLatex()}` },
      { m: `${left.toLatex()} - ${right.toLatex()} = ${value.toLatex()}` },
    ], 96, 500);
  }

  return {
    basic: [signedProduct, fractionAdd, powerTrap],
    medium: [integerMix, fractionMulDiv, bracketTimes, mixedPowers, complexFraction, squareThenDivide],
    advanced: [nested, doubleComplex],
  };
}

function proportion() {
  function basicRatio(rng) {
    const a = nonzero(rng, 1, 9);
    const b = nonzero(rng, 1, 9);
    const k = nonzero(rng, 1, 6);
    const x = a * k;
    const right = b * k;
    const stem = `${a} : x = ${b} : ${right}`;
    const answer = makeNumber(x);
    return emit("basic", "解比例式", stem, answer, [
      { t: "內項乘積等於外項乘積。" },
      { m: `${b} \\cdot x = ${a} \\times ${right}` },
      { m: `x = ${x}` },
    ]);
  }

  function simpleFraction(rng) {
    const d = irand(rng, 2, 9);
    const n = nonzero(rng, 1, 8);
    const x = irand(rng, -6, 8);
    if (x === 0) return null;
    const right = new Frac(n * x, d);
    if (!right.isInt()) return null;
    const stem = `\\dfrac{x}{${d}} = \\dfrac{${n}}{${d === n ? d + 1 : 1}}`;
    return null;
  }

  function direct(rng) {
    const a = nonzero(rng, 2, 8);
    const b = nonzero(rng, 2, 9);
    const x = irand(rng, -5, 8);
    const left = a * x;
    if (left === 0 || Math.abs(left) > 48) return null;
    const stem = `\\dfrac{${left}}{${a}} = \\dfrac{x}{${b}} \\cdot \\dfrac{${b}}{1}`;
    return null;
  }

  function colonShift(rng) {
    const x = irand(rng, -6, 8);
    const m = nonzero(rng, -4, 5);
    const p = nonzero(rng, 2, 6);
    const q = nonzero(rng, 2, 6);
    const left = x + m;
    if (left === 0 || (left * q) % p !== 0) return null;
    const s = (left * q) / p;
    if (s === 0 || Math.abs(s) > 36) return null;
    const stem = `\\left(x ${m < 0 ? m : `+ ${m}`}\\right) : ${p} = ${s} : ${q}`;
    const answer = makeNumber(x);
    return emit("basic", "解比例式", stem, answer, [
      { t: "內項乘積等於外項乘積。" },
      { m: `${q}\\left(x ${m < 0 ? m : `+ ${m}`}\\right) = ${p} \\times ${s}` },
      { m: `${q}x = ${p * s - q * m}` },
      { m: `x = ${answer.latex}` },
    ]);
  }

  function bothSides(rng) {
    const x = irand(rng, -5, 6);
    const a = nonzero(rng, 1, 4);
    const b = irand(rng, -4, 4);
    const c = nonzero(rng, 1, 4);
    const d = irand(rng, -5, 5);
    const m = nonzero(rng, 1, 5);
    const n = nonzero(rng, 1, 5);
    const left = a * x + b;
    const right = c * x + d;
    if (left === 0 || right === 0) return null;
    if (left * n !== right * m) return null;
    return null;
  }

  function crossLinear(rng, difficulty) {
    const x = irand(rng, -6, 6);
    const a = nonzero(rng, -4, 4);
    const b = irand(rng, -6, 6);
    const c = nonzero(rng, -4, 4);
    const d = irand(rng, -6, 6);
    const m = nonzero(rng, 1, 6);
    const n = nonzero(rng, 1, 6);
    const left = a * x + b;
    const right = c * x + d;
    if (right === 0 || left === 0) return null;
    if (left * n !== m * right) return null;
    return null;
  }

  function buildRatio(rng, difficulty) {
    const x = difficulty === "basic" ? irand(rng, -4, 8) : irand(rng, -6, 6);
    const a = difficulty === "advanced" ? nonzero(rng, -3, 3) : 1;
    const b = irand(rng, -5, 6);
    const c = difficulty === "basic" ? 0 : nonzero(rng, -3, 3);
    const d = difficulty === "basic" ? nonzero(rng, 2, 8) : irand(rng, -5, 6);
    const m = nonzero(rng, 1, 5);
    const n = nonzero(rng, 1, 5);
    const left = a * x + b;
    const right = c * x + d;
    if (right === 0 || gcd(Math.abs(m), Math.abs(n)) !== 1) return null;
    if (left * n !== m * right) {
      // Rebuild n, m from the two sides when they share a ratio.
    }
    const g = gcd(Math.abs(left), Math.abs(right));
    if (g === 0) return null;
    let mm = left / g;
    let nn = right / g;
    if (nn < 0) {
      mm = -mm;
      nn = -nn;
    }
    if (mm === 0 || nn === 0 || Math.abs(mm) > 12 || nn > 12) return null;
    if (c * x + d === 0) return null;
    const stem = `\\dfrac{${linLatex(a, b)}}{${linLatex(c, d)}} = \\dfrac{${mm}}{${nn}}`;
    const coef = nn * a - mm * c;
    const constant = mm * d - nn * b;
    if (coef === 0) return null;
    const solved = new Frac(constant, coef);
    if (!solved.eq(new Frac(x, 1))) return null;
    const answer = makeNumber(x);
    return emit(difficulty, "解比例式", stem, answer, [
      { t: "內項乘積等於外項乘積。" },
      { m: `${nn}\\left(${linLatex(a, b)}\\right) = ${mm}\\left(${linLatex(c, d)}\\right)` },
      { m: `${linLatex(nn * a, nn * b)} = ${linLatex(mm * c, mm * d)}` },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${answer.latex}` },
    ]);
  }

  return {
    basic: [basicRatio, (rng) => buildRatio(rng, "basic"), colonShift],
    medium: [
      (rng) => buildRatio(rng, "medium"),
      (rng) => buildRatio(rng, "medium"),
      (rng) => buildRatio(rng, "medium"),
      colonShift,
      basicRatio,
      (rng) => buildRatio(rng, "medium"),
    ],
    advanced: [(rng) => buildRatio(rng, "advanced"), (rng) => buildRatio(rng, "advanced")],
  };
}

function linearUnit() {
  function basic(rng) {
    const x = irand(rng, -8, 8);
    const a = nonzero(rng, 2, 9) * (rng() < 0.5 ? -1 : 1);
    const b = irand(rng, -9, 9);
    if (b === 0) return null;
    const c = a * x + b;
    if (Math.abs(c) > 60) return null;
    const stem = `${linLatex(a, b)} = ${c}`;
    return emit("basic", "解方程式", stem, makeNumber(x), [
      { t: "先把常數移到右邊，再除以 x 的係數。" },
      { m: `${a}x = ${c - b}` },
      { m: `x = ${x}` },
    ]);
  }

  function bothSides(rng) {
    const x = irand(rng, -6, 6);
    const a = nonzero(rng, -6, 6);
    const b = irand(rng, -8, 8);
    const c = nonzero(rng, -6, 6);
    const d = irand(rng, -8, 8);
    if (a === c) return null;
    const left = a * x + b;
    const right = c * x + d;
    if (left !== right || Math.abs(left) > 50) return null;
    return null;
  }

  function twoSides(rng, difficulty) {
    const x = irand(rng, -7, 7);
    const a = nonzero(rng, -6, 6);
    const b = irand(rng, -8, 8);
    const c = nonzero(rng, -6, 6);
    const d = irand(rng, -8, 8);
    if (a === c) return null;
    const value = a * x + b;
    if (value !== c * x + d || Math.abs(value) > 70) return null;
    return null;
  }

  function general(rng, difficulty) {
    const x = difficulty === "basic" ? irand(rng, -6, 6) : irand(rng, -8, 8);
    const a = nonzero(rng, -7, 7);
    const b = irand(rng, -8, 8);
    const c = difficulty === "basic" ? 0 : nonzero(rng, -6, 6);
    const d = difficulty === "basic" ? irand(rng, -9, 9) : irand(rng, -8, 8);
    if (a === c) return null;
    const left = a * x + b;
    const right = c * x + d;
    if (left !== right) {
      // Construct the right side from x so both sides match.
    }
    const rhs = a * x + b;
    const stem = c === 0 ? `${linLatex(a, b)} = ${rhs}` : `${linLatex(a, b)} = ${linLatex(c, rhs - c * x)}`;
    const actualRightConst = rhs - c * x;
    if (c !== 0 && a * x + b !== c * x + actualRightConst) return null;
    const coef = a - c;
    const constant = actualRightConst - b;
    if (coef === 0 || new Frac(constant, coef).n / new Frac(constant, coef).d !== x) return null;
    if (!new Frac(constant, coef).eq(new Frac(x, 1))) return null;
    return emit(difficulty, "解方程式", c === 0 ? `${linLatex(a, b)} = ${rhs}` : `${linLatex(a, b)} = ${linLatex(c, actualRightConst)}`, makeNumber(x), [
      { t: "含 x 的項移到左邊，常數移到右邊。" },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${x}` },
    ]);
  }

  function parentheses(rng) {
    const x = irand(rng, -6, 6);
    const p = nonzero(rng, -5, 5);
    const m = irand(rng, -5, 5);
    const q = nonzero(rng, -5, 5);
    if (p === q) return null;
    const leftConst = p * m;
    const rightConst = irand(rng, -6, 6);
    const left = p * x + leftConst;
    const right = q * x + rightConst;
    const extra = left - right;
    const shownRight = rightConst + extra;
    if (p * x + leftConst !== q * x + shownRight) return null;
    const stem = `${coefTimes(p, parenLin(1, m))} = ${linLatex(q, shownRight)}`;
    const coef = p - q;
    const constant = shownRight - leftConst;
    if (!new Frac(constant, coef).eq(new Frac(x, 1))) return null;
    return emit("medium", "解方程式", stem, makeNumber(x), [
      { t: "先去括號。" },
      { m: `${linLatex(p, leftConst)} = ${linLatex(q, shownRight)}` },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${x}` },
    ]);
  }

  function oneFraction(rng) {
    const den = pick(rng, [2, 3, 4, 5, 6]);
    const x = irand(rng, -6, 6);
    const a = nonzero(rng, -4, 4);
    const b = irand(rng, -6, 6);
    const rhs = new Frac(a * x + b, den);
    if (!decentNumber(rhs, 12, 30)) return null;
    const stem = `\\dfrac{${linLatex(a, b)}}{${den}} = ${rhs.toLatex()}`;
    return emit("medium", "解方程式", stem, makeNumber(x), [
      { t: `兩邊同乘 ${den}。` },
      { m: `${linLatex(a, b)} = ${rhs.mul(new Frac(den, 1)).toLatex()}` },
      { m: `x = ${x}` },
    ]);
  }

  function twoFractions(rng, difficulty) {
    const x = irand(rng, -6, 6);
    const c = pick(rng, [2, 3, 4, 5, 6]);
    const f = pick(rng, [2, 3, 4, 5, 6]);
    const a = nonzero(rng, -4, 4);
    const b = irand(rng, -5, 5);
    const d = nonzero(rng, -4, 4);
    const e = irand(rng, -5, 5);
    const coef = new Frac(a, c).add(new Frac(d, f));
    if (coef.isZero()) return null;
    const lhs = new Frac(a * x + b, c).add(new Frac(d * x + e, f));
    if (!decentNumber(lhs, difficulty === "advanced" ? 24 : 12, 40)) return null;
    const lcd = lcm(c, f);
    const t1 = lcd / c;
    const t2 = lcd / f;
    const mergedCoef = t1 * a + t2 * d;
    const mergedConst = t1 * b + t2 * e;
    const right = lhs.mul(new Frac(lcd, 1));
    if (!right.isInt()) return null;
    if (!new Frac(right.n - mergedConst, mergedCoef).eq(new Frac(x, 1))) return null;
    const sign = d < 0 || (d === 0 && e < 0) ? "-" : "+";
    const second = d < 0 || (d === 0 && e < 0) ? linLatex(-d, -e) : linLatex(d, e);
    const stem = `\\dfrac{${linLatex(a, b)}}{${c}} ${sign} \\dfrac{${second}}{${f}} = ${lhs.toLatex()}`;
    return emit(difficulty, "解方程式", stem, makeNumber(x), [
      { t: `兩邊同乘最小公倍量 ${lcd}。` },
      { m: `${coefTimes(t1, parenLin(a, b))} ${sign} ${coefTimes(t2, `\\left(${second}\\right)`)} = ${right.toLatex()}` },
      { m: `${linLatex(mergedCoef, mergedConst)} = ${right.toLatex()}` },
      { m: `${mergedCoef}x = ${right.n - mergedConst}` },
      { m: `x = ${x}` },
    ]);
  }

  function decimalEq(rng) {
    const x = irand(rng, -5, 6);
    const a = pick(rng, [2, 3, 4, 5]);
    const b = pick(rng, [-4, -2, 2, 4, 6]);
    const c = pick(rng, [1, 2, 3, 6]);
    if (a === c) return null;
    const left = (a * x + b) / 2;
    const right = (c * x) / 2 + (a * x + b - c * x) / 2;
    if (!Number.isInteger(a * x + b) || (a * x + b) % 2 !== 0) return null;
    const rhsConst = a * x + b - c * x;
    if (rhsConst % 2 !== 0) return null;
    const stem = `${a / 2}x ${b >= 0 ? "+" : "-"} ${Math.abs(b) / 2} = ${c / 2}x ${rhsConst >= 0 ? "+" : "-"} ${Math.abs(rhsConst) / 2}`;
    if (!Number.isInteger(b) || Math.abs(b) % 2 || Math.abs(rhsConst) % 2) return null;
    const coef = a - c;
    if (coef === 0 || (rhsConst - b) / coef !== x) return null;
    return emit("advanced", "解方程式", stem, makeNumber(x), [
      { t: "先把小數化成分數，或兩邊同乘 2。" },
      { m: `${linLatex(a, b)} = ${linLatex(c, rhsConst)}` },
      { m: `${coef}x = ${rhsConst - b}` },
      { m: `x = ${x}` },
    ]);
  }

  function nestedParen(rng) {
    const x = irand(rng, -5, 5);
    const a = nonzero(rng, -3, 3);
    const b = nonzero(rng, -3, 3);
    const c = nonzero(rng, -4, 4);
    const d = irand(rng, -4, 4);
    const e = nonzero(rng, -3, 3);
    // a(bx + c) + d = e x + (computed)
    const left = a * (b * x + c) + d;
    const eConst = irand(rng, -5, 5);
    const right = e * x + eConst;
    const adjust = left - right;
    const shown = eConst + adjust;
    if (a * (b * x + c) + d !== e * x + shown) return null;
    const expandedCoef = a * b;
    const expandedConst = a * c + d;
    const coef = expandedCoef - e;
    if (coef === 0 || (shown - expandedConst) / coef !== x) return null;
    const extra = d === 0 ? "" : d < 0 ? `${d}` : `+${d}`;
    const stem = `${coefTimes(a, parenLin(b, c))}${extra} = ${linLatex(e, shown)}`;
    return emit("advanced", "解方程式", stem, makeNumber(x), [
      { t: "先分配，再移項。" },
      { m: `${linLatex(expandedCoef, a * c)} ${d < 0 ? d : `+${d}`} = ${linLatex(e, shown)}` },
      { m: `${linLatex(expandedCoef, expandedConst)} = ${linLatex(e, shown)}` },
      { m: `${coef}x = ${shown - expandedConst}` },
      { m: `x = ${x}` },
    ]);
  }

  return {
    basic: [basic, (rng) => general(rng, "basic"), oneFraction],
    medium: [parentheses, oneFraction, (rng) => twoFractions(rng, "medium"), (rng) => general(rng, "medium"), parentheses, (rng) => twoFractions(rng, "medium")],
    advanced: [(rng) => twoFractions(rng, "advanced"), nestedParen, decimalEq],
  };
}

function ineqUnit() {
  function simple(rng, difficulty, forceNegative = false) {
    const xBound = irand(rng, -6, 6);
    const a = forceNegative ? nonzero(rng, -6, -1) : nonzero(rng, 1, 7);
    const b = irand(rng, -8, 8);
    const op = pick(rng, OPS);
    const c = a * xBound + b;
    const solved = solveIneq(a, b, 0, c, op);
    if (!solved || !solved.value.eq(new Frac(xBound, 1)) || solved.op !== op && a > 0) return null;
    if (a > 0 && solved.op !== op) return null;
    const stem = `${linLatex(a, b)} ${opLatex(op)} ${c}`;
    const steps = [
      { t: "常數移項。" },
      { m: `${a}x ${opLatex(op)} ${c - b}` },
    ];
    if (a < 0) steps.push({ t: "兩邊同除以負數，不等號要改向。" });
    steps.push({ m: `x ${opLatex(solved.op)} ${solved.value.toLatex()}` });
    return emit(difficulty, "解不等式", stem, makeIneq(solved.op, solved.value), steps);
  }

  function both(rng) {
    const boundary = new Frac(irand(rng, -5, 5), pick(rng, [1, 2]));
    const a = nonzero(rng, -5, 5);
    const c = nonzero(rng, -5, 5);
    if (a === c) return null;
    const b = irand(rng, -6, 6);
    const op = pick(rng, OPS);
    // ax+b op cx+d, and boundary satisfies equality: a*bound+b = c*bound+d
    const d = a * boundary.n / boundary.d + b - (c * boundary.n) / boundary.d;
    if (!Number.isInteger(d)) return null;
    const solved = solveIneq(a, b, c, d, op);
    if (!solved || !solved.value.eq(boundary)) return null;
    const stem = `${linLatex(a, b)} ${opLatex(op)} ${linLatex(c, d)}`;
    const steps = [
      { t: "含 x 的項放左邊，常數放右邊。" },
      { m: `${solved.coef}x ${opLatex(op)} ${solved.right}` },
    ];
    if (solved.coef < 0) steps.push({ t: "係數是負的，不等號要改向。" });
    steps.push({ m: `${makeIneq(solved.op, solved.value).latex}` });
    return emit("medium", "解不等式", stem, makeIneq(solved.op, solved.value), steps);
  }

  function paren(rng) {
    const boundary = irand(rng, -5, 5);
    const p = nonzero(rng, -4, 4);
    const m = irand(rng, -4, 4);
    const c = irand(rng, -4, 4);
    const op = pick(rng, OPS);
    const left = p * (boundary + m);
    const d = left - c * boundary;
    const solved = solveIneq(p, p * m, c, d, op);
    if (!solved || !solved.value.eq(new Frac(boundary, 1))) return null;
    const stem = `${coefTimes(p, parenLin(1, m))} ${opLatex(op)} ${linLatex(c, d)}`;
    const steps = [
      { t: "先去括號，再移項。" },
      { m: `${linLatex(p, p * m)} ${opLatex(op)} ${linLatex(c, d)}` },
      { m: `${solved.coef}x ${opLatex(op)} ${solved.right}` },
    ];
    if (solved.coef < 0) steps.push({ t: "兩邊同除以負數，不等號改向。" });
    steps.push({ m: makeIneq(solved.op, solved.value).latex });
    return emit("medium", "解不等式", stem, makeIneq(solved.op, solved.value), steps);
  }

  function fractional(rng, difficulty) {
    const boundary = irand(rng, -4, 5);
    const c = pick(rng, [2, 3, 4, 6]);
    const f = pick(rng, [2, 3, 4, 5]);
    const a = nonzero(rng, -3, 3);
    const b = irand(rng, -4, 4);
    const d = nonzero(rng, -3, 3);
    const e = irand(rng, -4, 4);
    const op = pick(rng, OPS);
    const rhs = new Frac(a * boundary + b, c).add(new Frac(d * boundary + e, f));
    if (!decentNumber(rhs, 12, 30)) return null;
    const solved = solveFractionIneq(
      [
        { a, b, c },
        { a: d, b: e, c: f },
      ],
      rhs,
      op,
    );
    if (!solved || !solved.value.eq(new Frac(boundary, 1))) return null;
    const sign = d < 0 || (d === 0 && e < 0) ? "-" : "+";
    const second = d < 0 || (d === 0 && e < 0) ? linLatex(-d, -e) : linLatex(d, e);
    const stem = `\\dfrac{${linLatex(a, b)}}{${c}} ${sign} \\dfrac{${second}}{${f}} ${opLatex(op)} ${rhs.toLatex()}`;
    const lcd = lcm(c, f);
    const clearedCoef = (lcd / c) * a + (lcd / f) * d;
    const clearedConst = (lcd / c) * b + (lcd / f) * e;
    const clearedRight = rhs.mul(new Frac(lcd, 1));
    if (!clearedRight.isInt() || clearedCoef === 0) return null;
    const steps = [
      { t: `兩邊同乘 ${lcd}，不等號先保持。` },
      { m: `${linLatex(clearedCoef, clearedConst)} ${opLatex(op)} ${clearedRight.toLatex()}` },
      { m: `${clearedCoef}x ${opLatex(op)} ${clearedRight.n - clearedConst}` },
    ];
    if (clearedCoef < 0) steps.push({ t: "係數是負的，不等號要改向。" });
    steps.push({ m: makeIneq(solved.op, solved.value).latex });
    return emit(difficulty, "解不等式", stem, makeIneq(solved.op, solved.value), steps);
  }

  return {
    basic: [(rng) => simple(rng, "basic", false), (rng) => simple(rng, "basic", false)],
    medium: [(rng) => simple(rng, "medium", true), both, paren, (rng) => fractional(rng, "medium"), both, paren],
    advanced: [(rng) => fractional(rng, "advanced"), (rng) => simple(rng, "advanced", true)],
  };
}

function systemUnit() {
  function elimination(a1, b1, c1, a2, b2, c2, x, y, difficulty) {
    const det = a1 * b2 - a2 * b1;
    if (det === 0) return null;
    const stem = `\\begin{cases} ${linLatex(a1, 0).replace("x", "x")} ${b1 < 0 ? "" : "+"} ${linLatex(0, 0)} \\\\ ${a2}x ${b2 < 0 ? "" : "+"} ${b2}y = ${c2} \\end{cases}`;
    return stem;
  }

  function eqLatex(a, b, c) {
    const left = [linLatex(a, 0, "x"), b === 1 ? "+y" : b === -1 ? "-y" : b > 0 ? `+${b}y` : `${b}y`].join("");
    const cleaned = left.replace(/^\+/, "");
    return `${cleaned} = ${c}`;
  }

  function pairProblem(rng, difficulty, kind) {
    const x = irand(rng, -6, 6);
    const y = irand(rng, -6, 6);
    let a1;
    let b1;
    let a2;
    let b2;
    if (kind === "sumdiff") {
      a1 = 1;
      b1 = 1;
      a2 = 1;
      b2 = -1;
    } else if (kind === "sub") {
      a1 = nonzero(rng, -3, 3);
      b1 = 0;
      a2 = nonzero(rng, -4, 4);
      b2 = nonzero(rng, -4, 4);
      // y expressed later; keep b1 nonzero instead
      b1 = nonzero(rng, -2, 2);
    } else {
      a1 = nonzero(rng, -5, 5);
      b1 = nonzero(rng, -5, 5);
      a2 = nonzero(rng, -5, 5);
      b2 = nonzero(rng, -5, 5);
    }
    if (a1 * b2 - a2 * b1 === 0) return null;
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    if (Math.abs(c1) > 48 || Math.abs(c2) > 48) return null;
    const mult1 = b2;
    const mult2 = b1;
    const coef = a1 * mult1 - a2 * mult2;
    const constant = c1 * mult1 - c2 * mult2;
    if (coef === 0 || constant / coef !== x) return null;
    const stem = `\\begin{cases} ${eqLatex(a1, b1, c1)} \\\\ ${eqLatex(a2, b2, c2)} \\end{cases}`;
    const answer = makePair(x, y);
    const yNum = c1 - a1 * x;
    if (b1 === 0 || yNum / b1 !== y) return null;
    return emit(difficulty, "解聯立方程式", stem, answer, [
      { t: `消去 y：第一式乘 ${mult1}，第二式乘 ${mult2}，再相減。` },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${x}` },
      { t: "代回第一式求 y。" },
      { m: `${eqLatex(a1, b1, c1).split("=")[0]} = ${c1}` },
      { m: `y = ${y}` },
    ]);
  }

  function substitution(rng) {
    const x = irand(rng, -5, 5);
    const m = nonzero(rng, -3, 3);
    const k = irand(rng, -5, 5);
    const y = m * x + k;
    const a = nonzero(rng, -4, 4);
    const b = nonzero(rng, -4, 4);
    const c = a * x + b * y;
    if (Math.abs(c) > 40) return null;
    const stem = `\\begin{cases} y = ${linLatex(m, k)} \\\\ ${eqLatex(a, b, c)} \\end{cases}`;
    const coef = a + b * m;
    const constant = c - b * k;
    if (coef === 0 || constant / coef !== x) return null;
    return emit("medium", "解聯立方程式", stem, makePair(x, y), [
      { t: "把 y 代入第二式。" },
      { m: `${a}x + ${b === 1 ? "" : b === -1 ? "-" : b}\\left(${linLatex(m, k)}\\right) = ${c}` },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${x}` },
      { m: `y = ${y}` },
    ]);
  }

  function fractional(rng) {
    const x = irand(rng, -4, 4) * 2;
    const y = irand(rng, -3, 3) * 3;
    const c1 = x / 2 + y / 3;
    const a2 = nonzero(rng, -3, 3);
    const b2 = nonzero(rng, -3, 3);
    const c2 = a2 * x + b2 * y;
    if (!Number.isInteger(c1) || Math.abs(c2) > 40) return null;
    if (3 * b2 === 2 * a2) return null;
    const cleared = c1 * 6;
    const coef = 3 * b2 - 2 * a2;
    const constant = cleared * b2 - 2 * c2;
    if (coef === 0 || constant / coef !== x) return null;
    const stem = `\\begin{cases} \\dfrac{1}{2}x + \\dfrac{1}{3}y = ${c1} \\\\ ${eqLatex(a2, b2, c2)} \\end{cases}`;
    return emit("advanced", "解聯立方程式", stem, makePair(x, y), [
      { t: "第一式兩邊乘 6，去掉分母。" },
      { m: `3x + 2y = ${cleared}` },
      { t: `消去 y：上式乘 ${b2}，第二式乘 2，再相減。` },
      { m: `${coef}x = ${constant}` },
      { m: `x = ${x}` },
      { t: "代回第二式。" },
      { m: `y = ${y}` },
    ]);
  }

  return {
    basic: [(rng) => pairProblem(rng, "basic", "sumdiff"), (rng) => pairProblem(rng, "basic", "easy")],
    medium: [
      (rng) => pairProblem(rng, "medium", "gen"),
      substitution,
      (rng) => pairProblem(rng, "medium", "gen"),
      substitution,
      (rng) => pairProblem(rng, "medium", "sub"),
      (rng) => pairProblem(rng, "medium", "gen"),
    ],
    advanced: [fractional, (rng) => pairProblem(rng, "advanced", "gen")],
  };
}

// The proportion and linear builders above include a few unused stubs.
// They stay unreachable from the returned template lists except where named.

function polyUnit() {
  function tri(a, b, c) {
    return Poly.var("x").pow(2).scale(new Frac(a, 1)).add(lin("x", b, c));
  }

  function addSub(rng, op) {
    const p = tri(nonzero(rng, -4, 4), irand(rng, -6, 6), irand(rng, -6, 6));
    const q = tri(nonzero(rng, -4, 4), irand(rng, -6, 6), irand(rng, -6, 6));
    const value = op === "-" ? p.sub(q) : p.add(q);
    if (value.isZero()) return null;
    const stem = `\\left(${p.toLatex()}\\right) ${op} \\left(${q.toLatex()}\\right)`;
    const steps = [{ t: op === "-" ? "括號前是減號，括號內每一項都變號，再合併同類項。" : "同類項係數相加。" }];
    steps.push({ m: value.toLatex() });
    return emit(op === "-" ? "medium" : "basic", "化簡", stem, makePoly(value), steps);
  }

  function monoTimes(rng) {
    const k = nonzero(rng, -5, 5);
    const exp = pick(rng, [1, 2]);
    const body = tri(irand(rng, -3, 3), nonzero(rng, -5, 5), irand(rng, -6, 6));
    const mono = Poly.var("x").pow(exp).scale(new Frac(k, 1));
    const value = mono.mul(body);
    const stem = `${k === -1 ? "-" : k === 1 ? "" : k}x${exp === 1 ? "" : `^{${exp}}`}\\left(${body.toLatex()}\\right)`;
    return emit("medium", "展開", stem, makePoly(value), [
      { t: "每一項都乘上這個單項式。" },
      { m: value.toLatex() },
    ]);
  }

  function binomTimesTri(rng) {
    const f = randPrimitive(rng, "x", 3, 5);
    const g = tri(pick(rng, [1, -1, 2]), nonzero(rng, -4, 4), irand(rng, -5, 5));
    const value = f.poly.mul(g);
    const stem = `${factorTex(f.p, f.q)}\\left(${g.toLatex()}\\right)`;
    return emit("medium", "展開", stem, makePoly(value), [
      { t: "用分配律，前一個因式乘以後一個每一項，再合併。" },
      { m: value.toLatex() },
    ]);
  }

  function productMinus(rng) {
    const a = randPrimitive(rng, "x", 3, 4);
    const b = randPrimitive(rng, "x", 3, 4);
    const c = randPrimitive(rng, "x", 3, 4);
    const d = randPrimitive(rng, "x", 3, 4);
    const value = a.poly.mul(b.poly).sub(c.poly.mul(d.poly));
    if (value.degree() < 1) return null;
    const stem = `${factorTex(a.p, a.q)}${factorTex(b.p, b.q)} - ${factorTex(c.p, c.q)}${factorTex(d.p, d.q)}`;
    return emit("advanced", "展開並化簡", stem, makePoly(value), [
      { t: "先分別展開兩個乘積，再相減。減號後面每一項變號。" },
      { m: `${a.poly.mul(b.poly).toLatex()} - \\left(${c.poly.mul(d.poly).toLatex()}\\right)` },
      { m: value.toLatex() },
    ]);
  }

  function threeFactors(rng) {
    const a = randPrimitive(rng, "x", 2, 4);
    const b = randPrimitive(rng, "x", 2, 4);
    const c = randPrimitive(rng, "x", 2, 3);
    const value = a.poly.mul(b.poly).mul(c.poly);
    const stem = `${factorTex(a.p, a.q)}${factorTex(b.p, b.q)}${factorTex(c.p, c.q)}`;
    return emit("advanced", "展開", stem, makePoly(value), [
      { t: "先乘前兩個因式，再乘第三個。" },
      { m: `\\left(${a.poly.mul(b.poly).toLatex()}\\right)\\cdot ${factorTex(c.p, c.q)}` },
      { m: value.toLatex() },
    ]);
  }

  return {
    basic: [(rng) => addSub(rng, "+"), (rng) => addSub(rng, "+")],
    medium: [(rng) => addSub(rng, "-"), monoTimes, binomTimesTri, (rng) => addSub(rng, "-"), monoTimes, binomTimesTri],
    advanced: [productMinus, threeFactors],
  };
}

function formulaUnit() {
  function square(rng, difficulty) {
    const a = difficulty === "basic" ? 1 : nonzero(rng, 1, 3);
    const b = difficulty === "basic" ? nonzero(rng, -6, 6) : nonzero(rng, -5, 5);
    const useY = difficulty !== "basic" && rng() < 0.5;
    const base = useY ? lin("x", a, 0).add(lin("y", b, 0)) : lin("x", a, b);
    const value = base.pow(2);
    const inner = useY ? linLatex(a, 0, "x") + (b > 0 ? `+${linLatex(b, 0, "y")}` : linLatex(b, 0, "y")) : linLatex(a, b);
    const stem = `\\left(${inner}\\right)^{2}`;
    return emit(difficulty === "basic" ? "basic" : "medium", "展開", stem, makePoly(value), [
      { t: "使用 (A+B)^2 = A^2 + 2AB + B^2。B 是負數時，2AB 也是負的。" },
      { m: value.toLatex() },
    ]);
  }

  function difference(rng) {
    const a = pick(rng, [1, 2, 3]);
    const b = nonzero(rng, 1, 8);
    const base1 = lin("x", a, b);
    const base2 = lin("x", a, -b);
    const value = base1.mul(base2);
    const stem = `\\left(${linLatex(a, b)}\\right)\\left(${linLatex(a, -b)}\\right)`;
    return emit("basic", "展開", stem, makePoly(value), [
      { t: "使用 (A+B)(A-B) = A^2 - B^2。" },
      { m: value.toLatex() },
    ]);
  }

  function cube(rng) {
    const b = nonzero(rng, -4, 4);
    const base = lin("x", 1, b);
    const value = base.pow(3);
    const stem = `\\left(${linLatex(1, b)}\\right)^{3}`;
    return emit("medium", "展開", stem, makePoly(value), [
      { t: "使用 (A+B)^3 = A^3 + 3A^2B + 3AB^2 + B^3。" },
      { m: value.toLatex() },
    ]);
  }

  function numberFormula(rng) {
    const kind = pick(rng, ["sq", "diff", "near"]);
    if (kind === "sq") {
      const n = pick(rng, [19, 21, 29, 31, 49, 51, 99, 101]);
      const near = n > 50 ? 100 : n > 40 ? 50 : n > 25 ? 30 : 20;
      const d = n - near;
      const value = n * n;
      return numQ("medium", `${n}^{2}`, value, [
        { t: `看成 (${near}${d < 0 ? d : `+${d}`})^2。` },
        { m: `${near}^{2} ${d < 0 ? "" : "+"} 2\\times${near}\\times${showInt(d, true)} + (${d})^{2}` },
        { m: `= ${value}` },
      ], 1, 20000);
    }
    if (kind === "diff") {
      const n = pick(rng, [100, 50, 40, 30]);
      const d = pick(rng, [1, 2, 3]);
      const left = n + d;
      const right = n - d;
      const value = left * left - right * right;
      return numQ("medium", `${left}^{2} - ${right}^{2}`, value, [
        { t: "平方差：A^2 - B^2 = (A-B)(A+B)。" },
        { m: `(${left}-${right})(${left}+${right}) = ${left - right} \\times ${left + right}` },
        { m: `= ${value}` },
      ]);
    }
    const n = pick(rng, [20, 30, 50, 100]);
    const d = pick(rng, [1, 2, 3]);
    const value = (n - d) * (n + d);
    return numQ("medium", `${n - d} \\times ${n + d}`, value, [
      { t: "看成 (A-B)(A+B) = A^2 - B^2。" },
      { m: `${n}^{2} - ${d}^{2} = ${value}` },
    ]);
  }

  function combine(rng) {
    const m = nonzero(rng, -4, 4);
    const n = nonzero(rng, 1, 5);
    const first = lin("x", 1, m).mul(lin("x", 1, -m));
    const second = lin("x", 1, n).pow(2);
    const value = first.sub(second);
    const stem = `\\left(${linLatex(1, m)}\\right)\\left(${linLatex(1, -m)}\\right) - \\left(${linLatex(1, n)}\\right)^{2}`;
    return emit("medium", "展開並化簡", stem, makePoly(value), [
      { t: "前半用平方差，後半用完全平方，再相減。" },
      { m: `${first.toLatex()} - \\left(${second.toLatex()}\\right)` },
      { m: value.toLatex() },
    ]);
  }

  function threeSquare(rng) {
    const a = nonzero(rng, 1, 3);
    const b = nonzero(rng, -3, 3);
    const c = nonzero(rng, -4, 4);
    if (gcd(gcd(a, Math.abs(b)), Math.abs(c)) !== 1) return null;
    const base = lin("x", a, 0).add(lin("y", b, 0)).add(Poly.fromInt(c));
    const value = base.pow(2);
    const yTex = b > 0 ? `+${linLatex(b, 0, "y")}` : linLatex(b, 0, "y");
    const cTex = c > 0 ? `+${c}` : `${c}`;
    const stem = `\\left(${linLatex(a, 0, "x")}${yTex}${cTex}\\right)^{2}`;
    return emit("advanced", "展開", stem, makePoly(value), [
      { t: "(A+B+C)^2 = A^2+B^2+C^2+2AB+2BC+2CA。負項要帶進 2 倍乘積。" },
      { m: value.toLatex() },
    ]);
  }

  function cubeDiff(rng) {
    const m = irand(rng, 1, 4);
    const n = irand(rng, 1, 3);
    const value = lin("x", 1, m).pow(3).sub(lin("x", 1, -n).pow(3));
    const stem = `\\left(${linLatex(1, m)}\\right)^{3} - \\left(${linLatex(1, -n)}\\right)^{3}`;
    return emit("advanced", "展開並化簡", stem, makePoly(value), [
      { t: "兩個立方分別展開，再相減。" },
      { m: value.toLatex() },
    ]);
  }

  return {
    basic: [(rng) => square(rng, "basic"), difference],
    medium: [(rng) => square(rng, "medium"), cube, numberFormula, combine, difference, numberFormula],
    advanced: [threeSquare, cubeDiff],
  };
}

function expUnit() {
  function decent(mono) {
    if (mono.coef.d > 8 || Math.abs(mono.coef.n) > 128) return false;
    for (const exp of mono.exps.values()) if (Math.abs(exp) > 12) return false;
    return true;
  }

  function varPow(name, exp) {
    if (!exp) return "";
    if (exp === 1) return name;
    return `${name}^{${exp}}`;
  }

  function coefBody(coef, body) {
    if (!body) return String(coef);
    if (coef === 1) return body;
    if (coef === -1) return `-${body}`;
    return `${coef}${body}`;
  }

  function product(rng) {
    const m = irand(rng, 2, 7);
    const n = irand(rng, 2, 7);
    const answer = new Mono(Frac.one, [["a", m + n]]);
    return emit("basic", "化簡", `a^{${m}} \\cdot a^{${n}}`, makeMono(answer), [
      { t: "同底數相乘，指數相加。" },
      { m: `a^{${m + n}}` },
    ]);
  }

  function power(rng) {
    const m = irand(rng, 2, 6);
    const n = irand(rng, 2, 4);
    const answer = new Mono(Frac.one, [["a", m * n]]);
    return emit("basic", "化簡", `\\left(a^{${m}}\\right)^{${n}}`, makeMono(answer), [
      { t: "次方的次方，指數相乘。" },
      { m: `a^{${m * n}}` },
    ]);
  }

  function quotient(rng) {
    const m = irand(rng, 2, 8);
    const n = irand(rng, 1, 6);
    const answer = new Mono(Frac.one, [["a", m - n]]);
    return emit("basic", "化簡", `\\dfrac{a^{${m}}}{a^{${n}}}`, makeMono(answer), [
      { t: "同底數相除，指數相減。負指數寫到分母。" },
      { m: answer.toLatex() },
    ]);
  }

  function coefPower(rng) {
    const coef = pick(rng, [2, 3, -2]);
    const m = irand(rng, 1, 4);
    const n = irand(rng, 2, 3);
    const answer = new Mono(new Frac(coef, 1), [["a", m]]).pow(n);
    if (!decent(answer)) return null;
    const stem = `\\left(${coefBody(coef, varPow("a", m))}\\right)^{${n}}`;
    return emit("medium", "化簡", stem, makeMono(answer), [
      { t: "係數和文字都要次方。係數先算，文字的指數相乘。" },
      { m: answer.toLatex() },
    ]);
  }

  function twoVar(rng) {
    const m = irand(rng, -3, 4);
    const n = irand(rng, -3, 4);
    const p = irand(rng, 2, 3);
    if (m === 0 && n === 0) return null;
    const answer = new Mono(Frac.one, [["a", m], ["b", n]]).pow(p);
    const stem = `\\left(${varPow("a", m)}${varPow("b", n)}\\right)^{${p}}`;
    return emit("medium", "化簡", stem, makeMono(answer), [
      { t: "括號外的次方乘到每一個指數。" },
      { m: answer.toLatex() },
    ]);
  }

  function productQuotient(rng, difficulty) {
    const c1 = pick(rng, [2, 3, -2]);
    const c2 = pick(rng, [2, 4]);
    const e1 = irand(rng, -2, 3);
    const f1 = irand(rng, -2, 3);
    const e2 = irand(rng, -2, 3);
    const f2 = irand(rng, -2, 3);
    const p = difficulty === "advanced" ? irand(rng, 2, 3) : 1;
    const q = difficulty === "advanced" ? irand(rng, 1, 3) : 1;
    const left = coefBody(c1, `${varPow("a", e1)}${varPow("b", f1)}`) || String(c1);
    const right = coefBody(c2, `${varPow("a", e2)}${varPow("b", f2)}`);
    let answer;
    let stem;
    if (difficulty === "advanced") {
      answer = new Mono(new Frac(c1, 1), [["a", e1], ["b", f1]])
        .pow(p)
        .mul(new Mono(new Frac(c2, 1), [["a", e2], ["b", f2]]))
        .div(new Mono(Frac.one, [["a", q], ["b", 1]]));
      stem = `\\dfrac{\\left(${left}\\right)^{${p}} \\cdot ${right}}{${varPow("a", q)}b}`;
    } else {
      answer = new Mono(new Frac(c1, 1), [["a", e1], ["b", f1]]).mul(new Mono(new Frac(c2, 1), [["a", e2], ["b", f2]]));
      stem = `${left} \\cdot ${right}`;
    }
    if (!decent(answer)) return null;
    return emit(difficulty, "化簡", stem, makeMono(answer), [
      { t: "先處理括號的次方，再把同文字的指數相加；相除就相減。" },
      { m: answer.toLatex() },
    ]);
  }

  function negativePower(rng) {
    const coef = pick(rng, [2, 3, 4]);
    const m = irand(rng, 1, 3);
    const n = irand(rng, 2, 3);
    const answer = new Mono(new Frac(coef, 1), [["x", -m]]).pow(-n);
    if (!decent(answer)) return null;
    const stem = `\\left(${coef} x^{${-m}}\\right)^{${-n}}`;
    return emit("advanced", "化簡", stem, makeMono(answer), [
      { t: "負指數的次方：係數取倒數再取正次方，文字的指數相乘。" },
      { m: answer.toLatex() },
    ]);
  }

  return {
    basic: [product, power, quotient],
    medium: [coefPower, twoVar, (rng) => productQuotient(rng, "medium"), quotient, coefPower, twoVar],
    advanced: [(rng) => productQuotient(rng, "advanced"), negativePower],
  };
}

function sciUnit() {
  function writeExpanded(rng, difficulty) {
    const mant = pick(rng, MANTS);
    const exp = difficulty === "basic" ? (rng() < 0.5 ? irand(rng, 2, 6) : irand(rng, -5, -2)) : irand(rng, -6, 6);
    if (exp === 0 || exp === 1) return null;
    const value = sciValue(mant, exp);
    const sci = handSci(normalizeSci(value));
    if (!sci) return null;
    const shown = value.isInt() && String(value.n).length <= 10 ? String(value.n) : decimalPlain(value);
    if (!shown || shown === sci.plain.split("*")[0]) return null;
    return emit(difficulty, "寫成科學記號", shown, makeSci(value, sci.plain, sci.latex), [
      { t: "小數點移到第一個非零數字後面。左移指數為正，右移為負。" },
      { m: sci.latex },
    ]);
  }

  function multiply(rng, difficulty) {
    const m1 = pick(rng, MANTS);
    const m2 = pick(rng, MANTS);
    const e1 = irand(rng, -4, 5);
    const e2 = irand(rng, -3, 4);
    if (e1 === 0 || e2 === 0) return null;
    const value = sciValue(m1, e1).mul(sciValue(m2, e2));
    const sci = handSci(normalizeSci(value));
    if (!sci) return null;
    const stem = `${m1} \\times 10^{${e1}} \\times ${m2} \\times 10^{${e2}}`;
    const rawMant = fracFromDecimal(m1).mul(fracFromDecimal(m2));
    return emit(difficulty, "計算並寫成科學記號", stem, makeSci(value, sci.plain, sci.latex), [
      { t: "係數相乘，10 的指數相加。係數不在 1 到 10 之間就再調整。" },
      { m: `${decimalPlain(rawMant) || rawMant.toLatex()} \\times 10^{${e1 + e2}}` },
      { m: sci.latex },
    ]);
  }

  function divide(rng) {
    const m1 = pick(rng, MANTS);
    const m2 = pick(rng, ["1.2", "1.5", "2", "2.5", "4", "5"]);
    const e1 = irand(rng, -2, 6);
    const e2 = irand(rng, -4, 3);
    if (e1 === 0 || e2 === 0) return null;
    const value = sciValue(m1, e1).div(sciValue(m2, e2));
    const sci = handSci(normalizeSci(value));
    if (!sci) return null;
    const stem = `\\dfrac{${m1} \\times 10^{${e1}}}{${m2} \\times 10^{${e2}}}`;
    return emit("medium", "計算並寫成科學記號", stem, makeSci(value, sci.plain, sci.latex), [
      { t: "係數相除，10 的指數相減。" },
      { m: sci.latex },
    ]);
  }

  function add(rng) {
    const exp = irand(rng, 2, 5);
    const m1 = pick(rng, MANTS);
    const m2 = pick(rng, ["1.5", "2", "2.5", "4", "4.5"]);
    const smaller = exp - pick(rng, [1, 2]);
    const value = sciValue(m1, exp).add(sciValue(m2, smaller));
    const sci = handSci(normalizeSci(value));
    if (!sci) return null;
    const stem = `${m1} \\times 10^{${exp}} + ${m2} \\times 10^{${smaller}}`;
    return emit("advanced", "計算並寫成科學記號", stem, makeSci(value, sci.plain, sci.latex), [
      { t: "先化成同一個 10 的次方，係數相加，再調回科學記號。" },
      { m: sci.latex },
    ]);
  }

  return {
    basic: [(rng) => writeExpanded(rng, "basic"), (rng) => writeExpanded(rng, "basic")],
    medium: [(rng) => multiply(rng, "medium"), divide, (rng) => writeExpanded(rng, "medium"), (rng) => multiply(rng, "medium"), divide, (rng) => writeExpanded(rng, "medium")],
    advanced: [add, (rng) => multiply(rng, "advanced")],
  };
}

function surdUnit() {
  function simplifyOne(rng, difficulty) {
    const square = pick(rng, [4, 9, 16, 25, 36]);
    const rest = difficulty === "basic" ? pick(rng, [2, 3, 5, 6, 7]) : pick(rng, [2, 3, 5, 6, 7, 10, 11]);
    const inside = square * rest;
    if (inside > 400) return null;
    const value = Radical.sqrtInt(inside);
    return emit(difficulty === "basic" ? "basic" : "medium", "化成最簡根式", `\\sqrt{${inside}}`, makeRadical(value), [
      { t: "把根號裡的完全平方提出來。" },
      { m: `\\sqrt{${inside}} = ${value.toLatex()}` },
    ]);
  }

  function fractionSqrt(rng) {
    const num = pick(rng, [4, 9, 16, 36, 12, 18, 48, 50]);
    const den = pick(rng, [3, 4, 9, 12, 16, 25]);
    const value = Radical.fromFrac(new Frac(num, den)).sqrt();
    if (!value.isRational() && !decentRadical(value)) return null;
    if (!decentRadical(value)) return null;
    return emit("medium", "化成最簡根式", `\\sqrt{\\dfrac{${num}}{${den}}}`, makeRadical(value), [
      { t: "根號裡的分數先約分，或寫成 √(分子) / √(分母)，分母再有理化。" },
      { m: value.toLatex() },
    ]);
  }

  function withCoef(rng) {
    const coef = pick(rng, [2, 3, 4, -2, -3]);
    const inside = pick(rng, [8, 12, 18, 20, 27, 32, 45, 48, 50, 75]);
    const value = Radical.sqrtInt(inside).scale(new Frac(coef, 1));
    return emit("medium", "化成最簡根式", `${coef}\\sqrt{${inside}}`, makeRadical(value), [
      { t: "先化簡根號，再乘係數。" },
      { m: value.toLatex() },
    ]);
  }

  function combinePreview(rng) {
    const a = pick(rng, [12, 18, 27, 32, 48, 50, 75]);
    const b = pick(rng, [3, 8, 12, 20, 27, 45]);
    const value = Radical.sqrtInt(a).add(Radical.sqrtInt(b));
    if (!decentRadical(value)) return null;
    return emit("advanced", "化成最簡根式", `\\sqrt{${a}} + \\sqrt{${b}}`, makeRadical(value), [
      { t: "各自化簡後，同類根式再合併。" },
      { m: `${Radical.sqrtInt(a).toLatex()} + ${Radical.sqrtInt(b).toLatex()}` },
      { m: value.toLatex() },
    ]);
  }

  return {
    basic: [(rng) => simplifyOne(rng, "basic"), (rng) => simplifyOne(rng, "basic")],
    medium: [(rng) => simplifyOne(rng, "medium"), fractionSqrt, withCoef, (rng) => simplifyOne(rng, "medium"), fractionSqrt, withCoef],
    advanced: [combinePreview, fractionSqrt],
  };
}

function surdOpUnit() {
  function like(rng) {
    const inside = pick(rng, [2, 3, 5, 6, 7]);
    const a = nonzero(rng, -6, 6);
    const b = nonzero(rng, -6, 6);
    const value = Radical.sqrtInt(inside).scale(new Frac(a + b, 1));
    const stem = `${coefTimes(a, `\\sqrt{${inside}}`)} + ${b < 0 ? `(${b})` : b}\\sqrt{${inside}}`;
    return emit("basic", "化簡", stem, makeRadical(value), [
      { t: "根號相同，係數相加減。" },
      { m: value.toLatex() },
    ]);
  }

  function simplifyThenAdd(rng) {
    const rest = pick(rng, [2, 3, 5]);
    const insides = [4, 9, 16, 36].map((sq) => sq * rest);
    const a = insides[irand(rng, 0, 2)];
    const b = insides[irand(rng, 1, 3)];
    const c = insides[irand(rng, 0, 3)];
    const sign = rng() < 0.5 ? -1 : 1;
    const value = Radical.sqrtInt(a).add(Radical.sqrtInt(b).scale(new Frac(sign, 1))).add(Radical.sqrtInt(c));
    if (!decentRadical(value)) return null;
    const stem = `\\sqrt{${a}} ${sign < 0 ? "-" : "+"} \\sqrt{${b}} + \\sqrt{${c}}`;
    return emit("medium", "化簡", stem, makeRadical(value), [
      { t: "先把每一個根號化簡，再合併同類項。" },
      { m: value.toLatex() },
    ]);
  }

  function product(rng) {
    const p = pick(rng, [2, 3, 5, 6, 7]);
    const q = pick(rng, [2, 3, 5]);
    const a = nonzero(rng, -4, 4);
    const b = nonzero(rng, 1, 5);
    const left = Radical.sqrtInt(p).scale(new Frac(a, 1)).add(Radical.fromInt(b));
    const right = Radical.sqrtInt(q).sub(Radical.fromInt(1));
    const value = left.mul(right);
    if (!decentRadical(value)) return null;
    const stem = `\\left(${a}\\sqrt{${p}} ${b < 0 ? "" : "+"} ${b}\\right)\\left(\\sqrt{${q}} - 1\\right)`;
    return emit("medium", "展開並化簡", stem, makeRadical(value), [
      { t: "分配律展開，√m·√n = √(mn)，再化簡。" },
      { m: value.toLatex() },
    ]);
  }

  function square(rng) {
    const inside = pick(rng, [2, 3, 5, 6]);
    const b = nonzero(rng, 1, 5);
    const base = Radical.sqrtInt(inside).add(Radical.fromInt(b));
    const value = base.pow(2);
    const stem = `\\left(\\sqrt{${inside}} + ${b}\\right)^{2}`;
    return emit("medium", "展開並化簡", stem, makeRadical(value), [
      { t: "(A+B)^2 = A^2 + 2AB + B^2，A^2 會把根號消掉。" },
      { m: value.toLatex() },
    ]);
  }

  function rationalize(rng, difficulty) {
    const p = pick(rng, [2, 3, 5, 6, 7]);
    const q = pick(rng, [2, 3, 5]);
    if (p === q) return null;
    const k = pick(rng, [2, 3, 4, 6, 8]);
    const den = Radical.sqrtInt(p).sub(Radical.sqrtInt(q));
    if (den.isZero()) return null;
    const value = Radical.fromInt(k).div(den);
    if (!decentRadical(value)) return null;
    const stem = `\\dfrac{${k}}{\\sqrt{${p}} - \\sqrt{${q}}}`;
    return emit(difficulty, "分母有理化", stem, makeRadical(value), [
      { t: "分子分母同乘共軛根式。" },
      { m: `\\dfrac{${k}\\left(\\sqrt{${p}}+\\sqrt{${q}}\\right)}{${p} - ${q}}` },
      { m: value.toLatex() },
    ]);
  }

  function divideSqrt(rng) {
    const rest = pick(rng, [2, 3, 5]);
    const a = pick(rng, [8, 12, 18, 27, 32, 50]);
    const b = pick(rng, [2, 3, 8, 12, 18]);
    const value = Radical.sqrtInt(a).div(Radical.sqrtInt(b));
    if (!decentRadical(value)) return null;
    return emit("advanced", "化簡", `\\dfrac{\\sqrt{${a}}}{\\sqrt{${b}}}`, makeRadical(value), [
      { t: "可先寫成一個根號，再化簡；分母留下的根號要有理化。" },
      { m: value.toLatex() },
    ]);
  }

  return {
    basic: [like, simplifyThenAdd],
    medium: [simplifyThenAdd, product, square, (rng) => rationalize(rng, "medium"), like, product],
    advanced: [(rng) => rationalize(rng, "advanced"), divideSqrt],
  };
}

function factorUnit() {
  function monic(rng, difficulty) {
    const m = nonzero(rng, -8, 8);
    const n = nonzero(rng, -8, 8);
    if (difficulty === "basic" && (Math.abs(m) > 5 || Math.abs(n) > 5)) return null;
    const poly = lin("x", 1, m).mul(lin("x", 1, n));
    const plain = `${linearPlain(1, m)}${linearPlain(1, n)}`;
    const latex = `${factorTex(1, m)}${factorTex(1, n)}`;
    const answer = factorAnswer(poly, plain, latex);
    if (!answer) return null;
    return emit(difficulty === "basic" ? "basic" : "medium", "因式分解", poly.toLatex(), answer, [
      { t: "找兩個數，乘積是常數項，和是一次項係數。" },
      { m: latex },
    ]);
  }

  function common(rng) {
    const k = pick(rng, [2, 3, 4, 5, 6, -2, -3]);
    const f = randPrimitive(rng, "x", 4, 6);
    if (f.p === 1 && f.q === 0) return null;
    const poly = f.poly.scale(new Frac(k, 1));
    const plain = `${k}${linearPlain(f.p, f.q)}`;
    const latex = `${k}${factorTex(f.p, f.q)}`;
    return emit("basic", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "先提公因式。" },
      { m: latex },
    ]);
  }

  function difference(rng) {
    const a = pick(rng, [1, 2, 3]);
    const b = pick(rng, [1, 2, 3, 4, 5]);
    const poly = lin("x", a, b).mul(lin("x", a, -b));
    const plain = `${linearPlain(a, b)}${linearPlain(a, -b)}`;
    const latex = `${factorTex(a, b)}${factorTex(a, -b)}`;
    return emit("medium", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "平方差：A^2 - B^2 = (A+B)(A-B)。" },
      { m: latex },
    ]);
  }

  function perfect(rng) {
    const a = pick(rng, [1, 2, 3]);
    const b = nonzero(rng, -6, 6);
    if (gcd(a, Math.abs(b)) !== 1) return null;
    const poly = lin("x", a, b).pow(2);
    const plain = `${linearPlain(a, b)}^2`;
    const latex = `${factorTex(a, b)}^{2}`;
    return emit("medium", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "完全平方：A^2 ± 2AB + B^2 = (A±B)^2。" },
      { m: latex },
    ]);
  }

  function cross(rng, difficulty) {
    const f = randPrimitive(rng, "x", difficulty === "advanced" ? 5 : 3, 6);
    const g = randPrimitive(rng, "x", difficulty === "advanced" ? 5 : 3, 6);
    if (f.p === 1 && g.p === 1 && difficulty !== "medium") return null;
    const poly = f.poly.mul(g.poly);
    const plain = `${linearPlain(f.p, f.q)}${linearPlain(g.p, g.q)}`;
    const latex = `${factorTex(f.p, f.q)}${factorTex(g.p, g.q)}`;
    return emit(difficulty, "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "十字交乘：兩組數的交乘和要等於一次項係數。" },
      { m: latex },
    ]);
  }

  function commonThen(rng) {
    const k = pick(rng, [2, 3, 4]);
    const m = nonzero(rng, 1, 6);
    const poly = lin("x", 1, m).mul(lin("x", 1, -m)).scale(new Frac(k, 1));
    const plain = `${k}${linearPlain(1, m)}${linearPlain(1, -m)}`;
    const latex = `${k}${factorTex(1, m)}${factorTex(1, -m)}`;
    return emit("medium", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "先提公因式，剩下的用平方差。" },
      { m: latex },
    ]);
  }

  function grouping(rng) {
    const m = nonzero(rng, -6, 6);
    const n = nonzero(rng, -6, 6);
    const poly = lin("x", 1, m).mul(lin("y", 1, n));
    const plain = `${linearPlain(1, m, "x")}${linearPlain(1, n, "y")}`;
    const latex = `${factorTex(1, m, "x")}${factorTex(1, n, "y")}`;
    return emit("advanced", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "兩兩一組，各提公因式，再提出共同的括號。" },
      { m: latex },
    ]);
  }

  function cubic(rng) {
    const m = nonzero(rng, 1, 5);
    const poly = lin("x", 1, 0).mul(lin("x", 1, m)).mul(lin("x", 1, -m)).scale(new Frac(2, 1));
    const plain = `2x${linearPlain(1, m)}${linearPlain(1, -m)}`;
    const latex = `2x${factorTex(1, m)}${factorTex(1, -m)}`;
    return emit("advanced", "因式分解", poly.toLatex(), factorAnswer(poly, plain, latex), [
      { t: "先提 2x，剩下的是平方差。" },
      { m: latex },
    ]);
  }

  return {
    basic: [(rng) => monic(rng, "basic"), common],
    medium: [(rng) => monic(rng, "medium"), difference, perfect, (rng) => cross(rng, "medium"), commonThen, perfect],
    advanced: [(rng) => cross(rng, "advanced"), grouping, cubic],
  };
}

function rationalUnit() {
  function cancelMono(rng) {
    const numExp = irand(rng, 2, 4);
    const denExp = irand(rng, 1, numExp - 1);
    const numCoef = pick(rng, [2, 3, 4, 6, 8, 12]);
    const denCoef = pick(rng, [2, 3, 4, 6]);
    const num = Poly.var("x").pow(numExp).scale(new Frac(numCoef, 1));
    const den = Poly.var("x").pow(denExp).scale(new Frac(denCoef, 1));
    const answer = ratAnswer(num, den);
    const power = (exp) => (exp === 1 ? "x" : `x^{${exp}}`);
    const stem = `\\dfrac{${numCoef}${power(numExp)}}{${denCoef}${power(denExp)}}`;
    return emit("basic", "化為最簡", stem, answer, [
      { t: "係數約分，x 的指數相減。" },
      { m: answer.latex },
    ]);
  }

  function cancelLinear(rng) {
    const m = nonzero(rng, -6, 6);
    const n = nonzero(rng, -6, 6);
    if (m === n) return null;
    const common = lin("x", 1, m);
    const num = common.mul(lin("x", 1, n));
    const den = common;
    const answer = ratAnswer(num, den);
    return emit("basic", "化為最簡", `\\dfrac{${num.toLatex()}}{${den.toLatex()}}`, answer, [
      { t: "先因式分解，再消去共同因式。分母不可為 0，作答不用寫限制。" },
      { m: answer.latex },
    ]);
  }

  function cancelQuad(rng) {
    const a = nonzero(rng, -5, 5);
    const b = nonzero(rng, -5, 5);
    const c = nonzero(rng, -5, 5);
    if (new Set([a, b, c]).size < 3) return null;
    const num = lin("x", 1, a).mul(lin("x", 1, b));
    const den = lin("x", 1, a).mul(lin("x", 1, c));
    const answer = ratAnswer(num, den);
    return emit("medium", "化為最簡", `\\dfrac{${num.toLatex()}}{${den.toLatex()}}`, answer, [
      { t: "分子分母都分解，消去共同因式。" },
      { m: answer.latex },
    ]);
  }

  function add(rng, difficulty) {
    const m = nonzero(rng, -4, 4);
    const n = nonzero(rng, -4, 4);
    if (m === n) return null;
    const p = difficulty === "advanced" ? nonzero(rng, -3, 3) : 1;
    const q = difficulty === "advanced" ? nonzero(rng, -3, 3) : 1;
    const d1 = lin("x", 1, m);
    const d2 = lin("x", 1, n);
    const num = d2.scale(new Frac(p, 1)).add(d1.scale(new Frac(q, 1)));
    const den = d1.mul(d2);
    const answer = ratAnswer(num, den);
    const stem = `\\dfrac{${p}}{${d1.toLatex()}} + \\dfrac{${q}}{${d2.toLatex()}}`;
    return emit(difficulty, "化為最簡", stem, answer, [
      { t: "通分後分子相加，再看還能不能約分。" },
      { m: `\\dfrac{${num.toLatex()}}{${den.toLatex()}}` },
      { m: answer.latex },
    ]);
  }

  function sub(rng) {
    const m = nonzero(rng, 1, 5);
    const d1 = lin("x", 1, 0).mul(lin("x", 1, m)); // x(x+m) = x^2+mx
    const d2 = lin("x", 1, 0);
    const num = lin("x", 1, m).sub(d1.divConst ? null : lin("x", 1, m));
    // x/(x(x+m)) - 1/x = 1/(x+m) - (x+m)/ (x(x+m)) = (1 - x - m) / (x(x+m))
    const leftNum = Poly.fromInt(1);
    const rightNum = lin("x", 1, m);
    const common = d2.mul(lin("x", 1, m));
    const combined = leftNum.sub(rightNum);
    const answer = ratAnswer(combined, common);
    const stem = `\\dfrac{x}{${common.toLatex()}} - \\dfrac{1}{x}`;
    // Wait stem doesn't match combined. Let me rebuild properly below.
    return null;
  }

  function subtractProper(rng) {
    const m = nonzero(rng, -5, 5);
    if (m === 0) return null;
    const den1 = lin("x", 1, m);
    const den2 = lin("x", 1, 0);
    // 1/(x+m) - 1/x
    const num = den2.sub(den1);
    const den = den1.mul(den2);
    const answer = ratAnswer(num, den);
    const stem = `\\dfrac{1}{${den1.toLatex()}} - \\dfrac{1}{x}`;
    return emit("medium", "化為最簡", stem, answer, [
      { t: "通分，分母是兩個分母的積。" },
      { m: answer.latex },
    ]);
  }

  function multiply(rng) {
    const a = nonzero(rng, -5, 5);
    const b = nonzero(rng, -5, 5);
    const c = nonzero(rng, -5, 5);
    if (a === b || a === c) return null;
    const num = lin("x", 1, a).mul(lin("x", 1, b));
    const den = lin("x", 1, a).mul(lin("x", 1, 0));
    const otherNum = lin("x", 1, 0);
    const otherDen = lin("x", 1, c);
    const answer = ratAnswer(num.mul(otherNum), den.mul(otherDen));
    const stem = `\\dfrac{${num.toLatex()}}{${den.toLatex()}} \\cdot \\dfrac{${otherNum.toLatex()}}{${otherDen.toLatex()}}`;
    return emit("advanced", "化為最簡", stem, answer, [
      { t: "先約分再相乘，不要先展開再約。" },
      { m: answer.latex },
    ]);
  }

  return {
    basic: [cancelMono, cancelLinear],
    medium: [cancelQuad, (rng) => add(rng, "medium"), subtractProper, cancelQuad, (rng) => add(rng, "medium"), subtractProper],
    advanced: [(rng) => add(rng, "advanced"), multiply],
  };
}

function quadUnit() {
  function fromFactors(rng, difficulty) {
    const f = randPrimitive(rng, "x", difficulty === "basic" ? 1 : difficulty === "advanced" ? 4 : 3, 6);
    const g = randPrimitive(rng, "x", difficulty === "basic" ? 1 : 3, 6);
    if (difficulty === "basic" && (f.p !== 1 || g.p !== 1)) return null;
    const poly = f.poly.mul(g.poly);
    const r1 = new Frac(-f.q, f.p);
    const r2 = new Frac(-g.q, g.p);
    for (const root of [r1, r2]) {
      if (!evalAtFrac(poly, root)?.isZero()) return null;
    }
    const answer = makeSet(uniqueRadicals([Radical.fromFrac(r1), Radical.fromFrac(r2)]));
    const disguise = difficulty !== "basic" && rng() < 0.45 && poly.terms().some((term) => term.i === 0);
    let stem = `${poly.toLatex()} = 0`;
    let steps = [
      { t: "把左邊因式分解，再令各因式為 0。" },
      { m: `${factorTex(f.p, f.q)}${factorTex(g.p, g.q)} = 0` },
      { m: answer.latex },
    ];
    if (disguise) {
      const constant = poly.terms().find((term) => term.i === 0)?.coef || Frac.zero;
      const moved = poly.sub(Poly.const(constant));
      stem = `${moved.toLatex()} = ${constant.neg().toLatex()}`;
      steps = [
        { t: "先移項，做成一邊是 0。" },
        { m: `${poly.toLatex()} = 0` },
        ...steps,
      ];
    }
    return emit(difficulty, "解方程式", stem, answer, steps);
  }

  function squareEq(rng) {
    const m = nonzero(rng, -6, 6);
    const k = pick(rng, [1, 4, 9, 16]);
    const left = lin("x", 1, m).pow(2);
    const r1 = new Frac(-m + Math.sqrt(k), 1);
    const r2 = new Frac(-m - Math.sqrt(k), 1);
    if (!Number.isInteger(Math.sqrt(k))) return null;
    const answer = makeSet(uniqueRadicals([Radical.fromFrac(r1), Radical.fromFrac(r2)]));
    return emit("medium", "解方程式", `\\left(${linLatex(1, m)}\\right)^{2} = ${k}`, answer, [
      { t: "開平方時記得正負兩個。" },
      { m: `${linLatex(1, m)} = \\pm ${Math.sqrt(k)}` },
      { m: answer.latex },
    ]);
  }

  function irrational(rng) {
    const b = nonzero(rng, -6, 6);
    const c = nonzero(rng, -6, 6);
    const disc = b * b - 4 * c;
    if (disc <= 0) return null;
    const sqrt = Radical.sqrtInt(disc);
    if (sqrt.isRational()) return null;
    const r1 = Radical.fromInt(-b).add(sqrt).scale(new Frac(1, 2));
    const r2 = Radical.fromInt(-b).sub(sqrt).scale(new Frac(1, 2));
    if (!plugQuadRadical(1, b, c, r1) || !plugQuadRadical(1, b, c, r2)) return null;
    if (!decentRadical(r1) || !decentRadical(r2)) return null;
    const poly = lin("x", b, c).add(Poly.var("x").pow(2));
    const answer = makeSet(uniqueRadicals([r1, r2]));
    return emit("advanced", "解方程式", `${poly.toLatex()} = 0`, answer, [
      { t: "用公式解。a=1，先算判別式。" },
      { m: `D = (${b})^{2} - 4\\times 1\\times (${c}) = ${disc}` },
      { m: `x = \\dfrac{${-b} \\pm \\sqrt{${disc}}}{2}` },
      { m: answer.latex },
    ]);
  }

  return {
    basic: [(rng) => fromFactors(rng, "basic"), (rng) => fromFactors(rng, "basic")],
    medium: [(rng) => fromFactors(rng, "medium"), squareEq, (rng) => fromFactors(rng, "medium"), squareEq, (rng) => fromFactors(rng, "medium"), (rng) => fromFactors(rng, "medium")],
    advanced: [irrational, (rng) => fromFactors(rng, "advanced")],
  };
}

function absUnit() {
  function simple(rng) {
    const a = pick(rng, [1, 2, -2, 3, -1]);
    const b = irand(rng, -6, 6);
    const k = irand(rng, 0, 8);
    const roots = absSolutions(a, b, k);
    if (!roots) return null;
    const answer = makeSet(uniqueRadicals(roots.map((root) => Radical.fromFrac(root))));
    const stem = `\\left|${linLatex(a, b)}\\right| = ${k}`;
    return emit("basic", "解方程式", stem, answer, [
      { t: k === 0 ? "絕對值為 0，裡面的式子就是 0。" : "絕對值等於正數，裡面的式子是該數或它的相反數。" },
      { m: answer.latex },
    ]);
  }

  function shifted(rng) {
    return simple(rng);
  }

  function pair(rng) {
    const a = nonzero(rng, -4, 4);
    const b = irand(rng, -6, 6);
    const c = nonzero(rng, -4, 4);
    const d = irand(rng, -6, 6);
    const roots = absPairSolutions(a, b, c, d);
    if (!roots || roots.length === 0) return null;
    if (roots.some((root) => !decentNumber(root, 12, 20))) return null;
    const answer = makeSet(uniqueRadicals(roots.map((root) => Radical.fromFrac(root))));
    const stem = `\\left|${linLatex(a, b)}\\right| = \\left|${linLatex(c, d)}\\right|`;
    return emit("medium", "解方程式", stem, answer, [
      { t: "|A| = |B| 表示 A = B 或 A = -B。" },
      { m: answer.latex },
    ]);
  }

  function outside(rng) {
    const m = nonzero(rng, -5, 5);
    const k = irand(rng, 1, 7);
    const coef = pick(rng, [2, 3]);
    const extra = irand(rng, -4, 4);
    const inside = coef * k;
    // coef |x-m| + extra = inside + extra
    const rhs = inside + extra;
    const roots = absSolutions(1, -m, k);
    if (!roots) return null;
    const answer = makeSet(uniqueRadicals(roots.map((root) => Radical.fromFrac(root))));
    const stem = `${coef}\\left|x ${m < 0 ? `+${-m}` : m === 0 ? "" : `-${m}`}\\right| ${extra < 0 ? extra : `+${extra}`} = ${rhs}`;
    if (m === 0) {
      // stem handled
    }
    const extraTex = extra === 0 ? "" : extra < 0 ? `${extra}` : `+${extra}`;
    const shown = `${coef}\\left|${linLatex(1, -m)}\\right|${extraTex} = ${rhs}`;
    return emit("medium", "解方程式", shown, answer, [
      { t: "先把絕對值單獨留在一邊。" },
      { m: `${coef}\\left|${linLatex(1, -m)}\\right| = ${inside}` },
      { m: `\\left|${linLatex(1, -m)}\\right| = ${k}` },
      { m: answer.latex },
    ]);
  }

  function sumCase(rng) {
    const a = irand(rng, -3, 2);
    const b = a + irand(rng, 2, 6);
    const mode = rng();
    let c;
    if (mode < 0.34) c = b - a;
    else if (mode < 0.67) c = b - a + pick(rng, [2, 4]);
    else c = Math.max(1, b - a - pick(rng, [1, 2, 3]));
    const answer = absSumAnswer(a, b, c);
    if (!answer) return null;
    const absTex = (point) => (point === 0 ? "x" : point > 0 ? `x-${point}` : `x+${-point}`);
    const stem = `\\left|${absTex(a)}\\right| + \\left|${absTex(b)}\\right| = ${c}`;
    const steps = [
      { t: `兩點距離是 ${Math.abs(b - a)}。絕對值的和最小就是這段距離。` },
    ];
    if (answer.kind === "none") steps.push({ t: "右邊比最小距離還小，所以無解。" }, { m: "無解" });
    else if (answer.between) steps.push({ t: "和剛好等於距離時，解是兩點之間的整段。" }, { m: answer.latex });
    else steps.push({ t: "和大於距離時，在兩點外側各有一解。" }, { m: answer.latex });
    return emit("advanced", "解方程式", stem, answer, steps);
  }

  return {
    basic: [simple, shifted],
    medium: [pair, outside, simple, pair, outside, pair],
    advanced: [sumCase, outside],
  };
}

export const UNITS = [
  {
    id: "intfrac",
    grade: "國一上",
    name: "整數與分數的四則運算",
    blurb: "括號、次方、負號，還有分數的加減乘除。",
    hint: "整數或最簡分數，例如 -3/4",
    templates: intfrac(),
  },
  {
    id: "proportion",
    grade: "國一下",
    name: "比例式",
    blurb: "內項乘積等於外項乘積，化成一元一次再解。",
    hint: "x 的值，例如 -3/2",
    templates: proportion(),
  },
  {
    id: "linear",
    grade: "國一下",
    name: "一元一次方程式",
    blurb: "去括號、去分母、移項，解出 x。",
    hint: "x 的值，例如 -3/4",
    templates: linearUnit(),
  },
  {
    id: "ineq",
    grade: "國一下",
    name: "一元一次不等式",
    blurb: "移項，遇到負數係數記得把不等號改向。",
    hint: "例如 x ≥ -1/2",
    templates: ineqUnit(),
  },
  {
    id: "system",
    grade: "國一下",
    name: "二元一次聯立方程式",
    blurb: "加減消去或代入，求出 x 和 y。",
    hint: "先 x 再 y，例如 2, -1",
    templates: systemUnit(),
  },
  {
    id: "poly",
    grade: "國二上",
    name: "多項式的運算",
    blurb: "加減時對齊同類項，乘法用分配律展開。",
    hint: "合併後的多項式，例如 2x^2 - 3x + 1",
    templates: polyUnit(),
  },
  {
    id: "formula",
    grade: "國二上",
    name: "乘法公式",
    blurb: "平方差、完全平方、立方公式，含數字計算。",
    hint: "展開後的多項式，或算出的數字",
    templates: formulaUnit(),
  },
  {
    id: "exp",
    grade: "國二上",
    name: "指數律",
    blurb: "同底數乘除、乘方，負指數改寫到分母。",
    hint: "例如 8a^2/b^3",
    templates: expUnit(),
  },
  {
    id: "sci",
    grade: "國二上",
    name: "科學記號",
    blurb: "a×10^n，係數 a 要落在 1 和 10 之間。",
    hint: "例如 3.2×10^5 或 3.2×10^-4",
    templates: sciUnit(),
  },
  {
    id: "surd",
    grade: "國二下",
    name: "根式的化簡",
    blurb: "把完全平方提出根號，分數根式一併化簡。",
    hint: "最簡根式，例如 2√3",
    templates: surdUnit(),
  },
  {
    id: "surdop",
    grade: "國二下",
    name: "根式的四則運算",
    blurb: "同類根式合併、展開，分母要有理化。",
    hint: "例如 2√3 - 1",
    templates: surdOpUnit(),
  },
  {
    id: "factor",
    grade: "國二下",
    name: "因式分解",
    blurb: "提公因式、公式、十字交乘。",
    hint: "例如 (2x-1)(x+3) 或 3(x-2)^2",
    templates: factorUnit(),
  },
  {
    id: "rational",
    grade: "國二下",
    name: "分式的運算",
    blurb: "約分、通分、分式乘除，寫成最簡分式。",
    hint: "例如 (x-1)/(x+2)",
    templates: rationalUnit(),
  },
  {
    id: "quad",
    grade: "國二下",
    name: "一元二次方程式",
    blurb: "因式分解或公式解。重根寫一次，開平方要正負。",
    hint: "由小到大，例如 -2, 3；根式可寫 (1+√5)/2",
    templates: quadUnit(),
  },
  {
    id: "abs",
    grade: "國三上",
    name: "絕對值",
    blurb: "絕對值方程式，含兩邊都有絕對值、以及距離和。",
    hint: "例如 -1, 4；區間寫 1 ≤ x ≤ 5；沒有解寫無解",
    templates: absUnit(),
  },
];

function generateFrom(unit, rng, difficulty, index) {
  const list = unit.templates[difficulty];
  const template = list[index % list.length];
  for (let attempt = 0; attempt < 50; attempt++) {
    const made = template(rng);
    if (made) {
      made.difficulty = difficulty;
      return made;
    }
  }
  return null;
}

export function sample(unit, difficulty, index, seed) {
  const rng = mulberry32(seed);
  const made = generateFrom(unit, rng, difficulty, index);
  if (!made) throw new Error(`${unit.id}／${difficulty}／題型 ${index} 出不了題`);
  return made;
}

export function buildSet(unit, seed) {
  const rng = mulberry32(seed >>> 0);
  const stems = new Set();
  const problems = [];
  for (const [difficulty, index] of PLAN) {
    let made = null;
    for (let shift = 0; shift < 16 && !made; shift++) {
      const candidate = generateFrom(unit, rng, difficulty, index + shift);
      if (candidate && !stems.has(candidate.stem)) {
        stems.add(candidate.stem);
        made = candidate;
      }
    }
    if (!made) throw new Error(`無法組成${unit.name}的${DIFFICULTY_LABEL[difficulty]}題`);
    problems.push(made);
  }
  return problems;
}

export function unitIndexForDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(2026, 0, 1);
  const diff = Math.floor((utc - epoch) / 86400000);
  return ((diff % UNITS.length) + UNITS.length) % UNITS.length;
}

export function unitForDate(dateStr) {
  return UNITS[unitIndexForDate(dateStr)];
}

export function seedFor(dateStr, unitId, variant) {
  return hashString(`${dateStr}|${unitId}|${variant}`);
}

export function checkPlain(answer) {
  return checkAnswer(answer, answer.plain);
}

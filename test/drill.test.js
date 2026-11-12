import assert from "node:assert/strict";
import test from "node:test";
import { Frac, Radical, checkAnswer, simplifyRational, Poly } from "../js/engine.js";
import { UNITS, buildSet, sample, PLAN } from "../js/units.js";

function radicalOf(input) {
  const answer = {
    kind: "radical",
    value: null,
    plain: input,
    latex: input,
  };
  return answer;
}

test("parser honors school precedence and radical division", () => {
  const negPower = checkAnswer({ kind: "number", value: new Frac(-4, 1), plain: "-4", latex: "-4" }, "-2^2");
  assert.equal(negPower.ok, true);
  const parenPower = checkAnswer({ kind: "number", value: new Frac(4, 1), plain: "4", latex: "4" }, "(-2)^2");
  assert.equal(parenPower.ok, true);

  const den = Radical.sqrtInt(5).sub(Radical.fromInt(1));
  const value = Radical.fromInt(4).div(den);
  assert.equal(value.eq(Radical.sqrtInt(5).add(Radical.fromInt(1))), true);
  const checked = checkAnswer({ kind: "radical", value, plain: value.toPlain(), latex: value.toLatex() }, "(√5+1)");
  assert.equal(checked.ok, true, checked.feedback);

  const six = Radical.fromInt(6).div(Radical.sqrtInt(7).sub(Radical.sqrtInt(3)));
  const expected = Radical.sqrtInt(7).add(Radical.sqrtInt(3)).scale(new Frac(3, 2));
  assert.equal(six.eq(expected), true, six.toPlain());
});

test("rational simplification cancels factors and content", () => {
  const num = Poly.var("x").pow(2).sub(Poly.fromInt(9));
  const den = Poly.var("x").sub(Poly.fromInt(3));
  const simplified = simplifyRational(num, den);
  assert.equal(simplified.num.eq(Poly.var("x").add(Poly.fromInt(3))), true);
  assert.equal(simplified.den.eq(Poly.fromInt(1)), true);

  const num2 = Poly.var("x").scale(new Frac(2, 1));
  const den2 = Poly.fromInt(4);
  const simplified2 = simplifyRational(num2, den2);
  assert.equal(simplified2.num.eq(Poly.var("x")), true);
  assert.equal(simplified2.den.eq(Poly.fromInt(2)), true);
});

test("factor form rejects an unfactored polynomial", () => {
  const poly = Poly.var("x").pow(2).sub(Poly.var("x").scale(new Frac(5, 1))).add(Poly.fromInt(6));
  const answer = { kind: "factor", poly, plain: "(x-2)(x-3)", latex: "(x-2)(x-3)" };
  assert.equal(checkAnswer(answer, "(x-2)(x-3)").ok, true);
  assert.equal(checkAnswer(answer, "(x-3)(x-2)").ok, true);
  const copied = checkAnswer(answer, "x^2-5x+6");
  assert.equal(copied.ok, false);
  assert.match(copied.feedback, /還沒分解/);
  const content = checkAnswer(answer, "(2x-4)(x-3)");
  assert.equal(content.ok, false);
});

test("scientific notation must be normalized", () => {
  const answer = { kind: "sci", value: new Frac(3200, 1), plain: "3.2*10^3", latex: "3.2\\times 10^{3}" };
  assert.equal(checkAnswer(answer, "3.2×10^3").ok, true);
  const loose = checkAnswer(answer, "32*10^2");
  assert.equal(loose.ok, false);
  assert.match(loose.feedback, /1/);
});

test("every template produces a checkable answer", () => {
  for (const unit of UNITS) {
    for (const difficulty of ["basic", "medium", "advanced"]) {
      unit.templates[difficulty].forEach((_, index) => {
        for (let seed = 1; seed <= 12; seed++) {
          const made = sample(unit, difficulty, index, seed * 1000 + index * 17 + difficulty.length);
          const checked = checkAnswer(made.answer, made.answer.plain);
          assert.equal(checked.ok, true, `${unit.id} ${difficulty} #${index} seed ${seed}: ${checked.feedback} plain=${made.answer.plain}`);
          assert.equal(made.steps.length > 0, true);
          assert.equal(typeof made.stem, "string");
        }
      });
    }
  }
});

test("a daily set is 2 basic, 6 medium, 2 advanced and rejects a wrong answer", () => {
  for (const unit of UNITS) {
    for (let variant = 0; variant < 4; variant++) {
      const set = buildSet(unit, 20261112 + variant * 97 + unit.id.length * 13);
      assert.equal(set.length, PLAN.length);
      const counts = { basic: 0, medium: 0, advanced: 0 };
      for (const item of set) counts[item.difficulty] += 1;
      assert.deepEqual(counts, { basic: 2, medium: 6, advanced: 2 });
      const wrong = checkAnswer(set[0].answer, "999999");
      if (set[0].answer.kind !== "none") assert.equal(wrong.ok, false);
    }
  }
});

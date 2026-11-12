import { checkAnswer } from "./engine.js";
import { DIFFICULTY_LABEL, UNITS, buildSet, seedFor, unitForDate } from "./units.js";

const STORAGE_KEY = "school-math-v1";
const params = new URLSearchParams(location.search);
const SELFTEST = params.get("selftest") === "1";

const store = loadStore();
const state = {
  date: "",
  unitId: "",
  variant: 0,
  problems: [],
  error: "",
};

const railEl = document.getElementById("rail");
const mastEl = document.getElementById("mast");
const problemsEl = document.getElementById("problems");
const loadNote = document.getElementById("load-note");

document.body.addEventListener("click", onClick);
problemsEl.addEventListener("input", onInput);
problemsEl.addEventListener("keydown", onKeydown);
window.addEventListener("afterprint", clearPrintMode);

const preview = params.get("preview");
if (preview === "blank" || preview === "key") {
  document.body.classList.add(preview === "key" ? "print-key" : "print-blank");
}

try {
  applyInitialRoute();
  renderAll();
  if (SELFTEST) runSelftest();
} catch (error) {
  showFatal(error);
}

function loadStore() {
  const empty = { variant: {}, drafts: {}, open: {}, done: {} };
  if (SELFTEST) return empty;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      variant: parsed.variant || {},
      drafts: parsed.drafts || {},
      open: parsed.open || {},
      done: parsed.done || {},
    };
  } catch {
    return empty;
  }
}

function saveStore() {
  if (SELFTEST) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function todayIso() {
  return isoFromDate(new Date());
}

function isoFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return value;
}

function addDays(iso, amount) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return isoFromDate(date);
}

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

function draftKey() {
  return `${state.date}|${state.unitId}|${state.variant}`;
}

function variantKey() {
  return `${state.date}|${state.unitId}`;
}

function currentUnit() {
  return UNITS.find((unit) => unit.id === state.unitId) || unitForDate(state.date);
}

function applyInitialRoute() {
  state.date = validDate(params.get("date")) || todayIso();
  const requested = UNITS.find((unit) => unit.id === params.get("unit"));
  state.unitId = (requested || unitForDate(state.date)).id;
  const fromUrl = Number(params.get("variant"));
  if (Number.isInteger(fromUrl) && fromUrl >= 0) state.variant = fromUrl;
  else state.variant = store.variant[variantKey()] || 0;
}

function syncUrl() {
  if (SELFTEST) return;
  const next = new URLSearchParams();
  next.set("date", state.date);
  if (state.unitId !== unitForDate(state.date).id) next.set("unit", state.unitId);
  if (state.variant) next.set("variant", String(state.variant));
  const query = next.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

function loadProblems() {
  const unit = currentUnit();
  try {
    state.problems = buildSet(unit, seedFor(state.date, unit.id, state.variant));
    state.error = "";
  } catch (error) {
    state.problems = [];
    state.error = "這組題目組不出來，請換一組。";
    console.error(error);
  }
}

function renderAll() {
  store.variant[variantKey()] = state.variant;
  saveStore();
  syncUrl();
  loadProblems();
  renderRail();
  renderMast();
  renderProblems();
  document.title = `每日十題・${currentUnit().name}`;
  document.body.dataset.unit = state.unitId;
  document.body.dataset.date = state.date;
}

function renderRail() {
  const scheduled = unitForDate(state.date);
  const mark = state.date === todayIso() ? "今日" : "當日";
  railEl.replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "rail-kicker";
  kicker.textContent = "每日十題";
  const title = document.createElement("p");
  title.className = "rail-title";
  title.textContent = "單元";
  railEl.append(kicker, title);
  for (const unit of UNITS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "unit-btn";
    button.dataset.action = "unit";
    button.dataset.unit = unit.id;
    if (unit.id === state.unitId) button.classList.add("is-active");
    button.setAttribute("aria-current", unit.id === state.unitId ? "true" : "false");
    const grade = document.createElement("span");
    grade.className = "grade";
    grade.textContent = unit.grade;
    const name = document.createElement("span");
    name.className = "unit-name";
    name.textContent = unit.name;
    button.append(grade, name);
    if (unit.id === scheduled.id) {
      const flag = document.createElement("span");
      flag.className = "day-mark";
      flag.textContent = mark;
      button.append(flag);
    }
    railEl.append(button);
  }
}

function renderMast() {
  const unit = currentUnit();
  const scheduled = unitForDate(state.date).id === unit.id;
  mastEl.replaceChildren();

  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = "國中數學基本功";

  const heading = document.createElement("h1");
  heading.textContent = unit.name;

  const rule = document.createElement("hr");
  rule.className = "rule";

  const meta = document.createElement("p");
  meta.className = "meta";
  const time = document.createElement("time");
  time.dateTime = state.date;
  time.textContent = formatDate(state.date);
  const grade = document.createElement("span");
  grade.textContent = unit.grade;
  const setNo = document.createElement("span");
  setNo.textContent = `第 ${state.variant + 1} 組`;
  const dayNote = document.createElement("span");
  dayNote.textContent = scheduled ? "這一天的單元" : "複習其他單元";
  meta.append(time, grade, setNo, dayNote);

  const blurb = document.createElement("p");
  blurb.className = "blurb";
  blurb.textContent = unit.blurb;

  const mix = document.createElement("p");
  mix.className = "mix";
  mix.textContent = "基礎 2 題、中等 6 題、進階 2 題。只練計算，沒有應用題。";

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar no-print";
  const dates = document.createElement("div");
  dates.className = "cluster";
  dates.append(
    button("前一天", "prev", "ghost"),
    button("今天", "today", "ghost"),
    button("後一天", "next", "ghost", state.date >= todayIso()),
  );
  const actions = document.createElement("div");
  actions.className = "cluster";
  if (state.variant > 0) actions.append(button("上一組", "prev-set", "ghost"));
  actions.append(button("換一組", "reshuffle", "ghost"), button("全部核對", "check-all", "primary"));
  const prints = document.createElement("div");
  prints.className = "cluster";
  prints.append(button("列印題目", "print-blank", "ghost"), button("列印解答", "print-key", "ghost"));
  toolbar.append(dates, actions, prints);

  const help = document.createElement("p");
  help.className = "help no-print";
  help.textContent = "分數寫 a/b，根號寫 sqrt(3)，次方寫 ^，科學記號寫 3.2×10^5。沒有解寫「無解」。";

  const scoreline = document.createElement("div");
  scoreline.className = "scoreline no-print";
  const score = document.createElement("p");
  score.className = "score";
  score.id = "score";
  const streak = document.createElement("p");
  streak.className = "streak";
  streak.id = "streak";
  scoreline.append(score, streak);

  mastEl.append(kicker, heading, rule, meta, blurb, mix, toolbar, help, scoreline);
}

function button(label, action, kind, disabled = false) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `btn ${kind}`;
  node.dataset.action = action;
  node.textContent = label;
  node.disabled = disabled;
  if (disabled) node.title = "先做今天的";
  return node;
}

function renderProblems() {
  problemsEl.replaceChildren();
  loadNote.hidden = true;
  if (state.error) {
    const note = document.createElement("p");
    note.className = "error-note";
    note.textContent = state.error;
    problemsEl.append(note);
    paintProgress();
    return;
  }
  const drafts = store.drafts[draftKey()] || [];
  const open = store.open[draftKey()] || [];
  const unit = currentUnit();
  let previous = "";
  state.problems.forEach((problem, index) => {
    const card = document.createElement("li");
    card.className = "card";
    card.dataset.index = String(index);
    if (problem.difficulty !== previous) card.classList.add("group-start");
    previous = problem.difficulty;

    const top = document.createElement("div");
    top.className = "card-top";
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(index + 1);
    const diff = document.createElement("span");
    diff.className = `diff diff-${problem.difficulty}`;
    diff.textContent = DIFFICULTY_LABEL[problem.difficulty];
    const prompt = document.createElement("span");
    prompt.className = "prompt";
    prompt.textContent = problem.prompt;
    top.append(num, diff, prompt);

    const stem = document.createElement("div");
    stem.className = "stem";
    typeset(stem, problem.stem, true);

    const row = document.createElement("div");
    row.className = "answer-row";
    const label = document.createElement("label");
    const sr = document.createElement("span");
    sr.className = "sr";
    sr.textContent = `第 ${index + 1} 題答案`;
    const ans = document.createElement("span");
    ans.className = "ans-label";
    ans.setAttribute("aria-hidden", "true");
    ans.textContent = "答";
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.autocapitalize = "off";
    input.placeholder = unit.hint;
    input.setAttribute("aria-label", `第 ${index + 1} 題答案`);
    input.value = drafts[index] || "";
    label.append(sr, ans, input);
    const check = document.createElement("button");
    check.type = "button";
    check.className = "btn";
    check.dataset.action = "check";
    check.textContent = "核對";
    row.append(label, check);

    const write = document.createElement("div");
    write.className = "write-line";
    write.textContent = "答：";

    const feedback = document.createElement("p");
    feedback.className = "feedback";
    feedback.setAttribute("role", "status");

    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "reveal no-print";
    reveal.dataset.action = "reveal";
    reveal.textContent = open[index] ? "收起詳解" : "看詳解";

    const solution = document.createElement("div");
    solution.className = "solution";
    if (open[index]) card.classList.add("is-open");
    const solutionLabel = document.createElement("p");
    solutionLabel.className = "solution-label";
    solutionLabel.textContent = "解答";
    const answer = document.createElement("div");
    answer.className = "answer-tex";
    typeset(answer, problem.answer.latex, true);
    const steps = document.createElement("div");
    steps.className = "steps";
    for (const step of problem.steps) {
      if (step.t) {
        const text = document.createElement("p");
        text.className = "step-text";
        text.textContent = step.t;
        steps.append(text);
      } else if (step.m) {
        const math = document.createElement("div");
        math.className = "step-math";
        typeset(math, step.m, true);
        steps.append(math);
      }
    }
    solution.append(solutionLabel, answer, steps);
    card.append(top, stem, row, write, feedback, reveal, solution);
    problemsEl.append(card);
    if (input.value.trim()) applyCheck(card, problem, input.value, false);
  });
  paintProgress();
}

function typeset(node, latex, display) {
  node.replaceChildren();
  if (!latex) return;
  if (!window.katex) {
    node.textContent = latex;
    return;
  }
  try {
    node.innerHTML = window.katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    node.textContent = latex;
  }
}

function onClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  const action = trigger.dataset.action;
  if (action === "unit") selectUnit(trigger.dataset.unit);
  else if (action === "prev") shiftDate(-1);
  else if (action === "next") shiftDate(1);
  else if (action === "today") goToday();
  else if (action === "reshuffle") shiftVariant(1);
  else if (action === "prev-set") shiftVariant(-1);
  else if (action === "check-all") checkAll();
  else if (action === "check") checkCard(trigger.closest(".card"));
  else if (action === "reveal") toggleReveal(trigger.closest(".card"));
  else if (action === "print-blank") printMode("blank");
  else if (action === "print-key") printMode("key");
}

function onInput(event) {
  if (event.target.tagName !== "INPUT") return;
  const card = event.target.closest(".card");
  if (!card) return;
  card.dataset.status = "";
  card.querySelector(".feedback").textContent = "";
  saveDrafts();
  paintProgress();
}

function onKeydown(event) {
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
  event.preventDefault();
  const card = event.target.closest(".card");
  checkCard(card);
  const next = document.querySelector(`.card[data-index="${Number(card.dataset.index) + 1}"] input`);
  if (next) next.focus();
}

function selectUnit(unitId) {
  if (!UNITS.some((unit) => unit.id === unitId)) return;
  state.unitId = unitId;
  state.variant = store.variant[variantKey()] || 0;
  renderAll();
}

function shiftDate(amount) {
  const next = addDays(state.date, amount);
  if (amount > 0 && next > todayIso()) return;
  state.date = next;
  state.unitId = unitForDate(state.date).id;
  state.variant = store.variant[variantKey()] || 0;
  renderAll();
}

function goToday() {
  state.date = todayIso();
  state.unitId = unitForDate(state.date).id;
  state.variant = store.variant[variantKey()] || 0;
  renderAll();
}

function shiftVariant(amount) {
  state.variant = Math.max(0, state.variant + amount);
  renderAll();
}

function checkCard(card) {
  if (!card) return null;
  const index = Number(card.dataset.index);
  const problem = state.problems[index];
  const value = card.querySelector("input").value;
  return applyCheck(card, problem, value, true);
}

function applyCheck(card, problem, value, persist) {
  const result = checkAnswer(problem.answer, value);
  card.dataset.status = result.ok ? "ok" : "bad";
  card.querySelector(".feedback").textContent = result.ok ? "答對了。" : result.feedback;
  if (persist) {
    saveDrafts();
    paintProgress();
  }
  return result;
}

function checkAll() {
  let firstBad = null;
  for (const card of problemsEl.querySelectorAll(".card")) {
    const result = checkCard(card);
    if (result && !result.ok && !firstBad) firstBad = card;
  }
  if (firstBad) firstBad.scrollIntoView({ block: "center" });
}

function toggleReveal(card) {
  if (!card) return;
  const open = card.classList.toggle("is-open");
  card.querySelector(".reveal").textContent = open ? "收起詳解" : "看詳解";
  saveOpen();
}

function saveDrafts() {
  const values = [...problemsEl.querySelectorAll(".card input")].map((input) => input.value);
  store.drafts[draftKey()] = values;
  saveStore();
}

function saveOpen() {
  store.open[draftKey()] = [...problemsEl.querySelectorAll(".card")].map((card) => card.classList.contains("is-open"));
  saveStore();
}

function paintProgress() {
  const score = document.getElementById("score");
  const streak = document.getElementById("streak");
  if (!score || !streak) return;
  const cards = [...problemsEl.querySelectorAll(".card")];
  const correct = cards.filter((card) => card.dataset.status === "ok").length;
  const scheduled = unitForDate(state.date).id === state.unitId;
  if (scheduled && cards.length === 10 && correct === 10) store.done[state.date] = true;
  saveStore();
  if (!cards.length) score.textContent = "";
  else if (correct === 10 && scheduled) {
    score.textContent = state.date === todayIso()
      ? "十題都對了。今天的單元完成。"
      : "十題都對了。這一天的單元完成。";
  } else if (correct === 10) score.textContent = "這組十題都對了。";
  else score.textContent = `答對 ${correct}／10`;
  streak.textContent = streakText();
}

function streakText() {
  const today = todayIso();
  const info = streakEnding(today);
  if (info.todayDone && info.days > 0) return `今日已完成 · 連續 ${info.days} 天`;
  if (info.days > 0) return `連續 ${info.days} 天 · 今天還沒完成`;
  return "完成今天的十題，連續天數就從這裡開始。";
}

function streakEnding(today) {
  const todayDone = !!store.done[today];
  let cursor = todayDone ? today : addDays(today, -1);
  let days = 0;
  while (store.done[cursor]) {
    days += 1;
    cursor = addDays(cursor, -1);
    if (days > 4000) break;
  }
  return { todayDone, days };
}

function printMode(mode) {
  clearPrintMode();
  document.body.classList.add(mode === "key" ? "print-key" : "print-blank");
  window.print();
}

function clearPrintMode() {
  if (params.get("preview") === "blank" || params.get("preview") === "key") return;
  document.body.classList.remove("print-blank", "print-key");
}

function showFatal(error) {
  loadNote.hidden = true;
  problemsEl.replaceChildren();
  const note = document.createElement("p");
  note.className = "error-note";
  note.textContent = "練習頁載入失敗。";
  problemsEl.append(note);
  console.error(error);
  if (!SELFTEST) return;
  const box = document.getElementById("selftest");
  box.hidden = false;
  box.dataset.status = "fail";
  box.textContent = `SELFTEST fail\n${error && error.stack ? error.stack : error}`;
}

function runSelftest() {
  const box = document.getElementById("selftest");
  const openedOn = state.date;
  const openedUnit = state.unitId;
  try {
    assert(openedUnit === unitForDate(openedOn).id, "opened unit is not the day's unit");
    assert(unitForDate("2026-11-12").id === "intfrac", "2026-11-12 should be 整數與分數");
    assert(problemsEl.querySelectorAll(".card").length === 10, "card count");
    const labels = [...problemsEl.querySelectorAll(".diff")].map((node) => node.textContent).join(",");
    assert(labels === "基礎,基礎,中等,中等,中等,中等,中等,中等,進階,進階", `difficulty ${labels}`);
    assert(document.querySelector("h1").textContent === currentUnit().name, "heading");
    assert(problemsEl.querySelectorAll(".stem .katex").length === 10, "katex stems");
    document.querySelector(".reveal").click();
    assert(document.querySelector(".card").classList.contains("is-open"), "reveal");
    assert(document.querySelector(".answer-tex .katex"), "answer latex");

    const cards = [...problemsEl.querySelectorAll(".card")];
    cards.forEach((card, index) => {
      card.querySelector("input").value = state.problems[index].answer.plain;
      card.querySelector("[data-action='check']").click();
      assert(card.dataset.status === "ok", `correct ${index} ${state.problems[index].answer.plain}`);
    });
    assert(document.getElementById("score").textContent.includes("十題都對了"), "score");
    assert(store.done[openedOn] === true, "day marked done");

    const first = cards[0];
    first.querySelector("input").value = "999999";
    first.querySelector("[data-action='check']").click();
    assert(first.dataset.status === "bad", "wrong status");
    assert(first.querySelector(".feedback").textContent.length > 0, "wrong feedback");
    first.querySelector("input").value = state.problems[0].answer.plain;
    first.querySelector("[data-action='check']").click();
    assert(first.dataset.status === "ok", "restored");

    document.body.classList.add("print-blank");
    assert(getComputedStyle(document.querySelector(".write-line")).display !== "none", "print blank");
    document.body.classList.remove("print-blank");
    document.body.classList.add("print-key");
    const closed = cards.find((card) => !card.classList.contains("is-open"));
    assert(closed && getComputedStyle(closed.querySelector(".solution")).display !== "none", "print key");
    document.body.classList.remove("print-key");

    const before = state.problems.map((problem) => problem.stem).join("\n");
    const variantBefore = state.variant;
    document.querySelector("[data-action='reshuffle']").click();
    assert(state.variant === variantBefore + 1, "variant");
    assert(state.problems.map((problem) => problem.stem).join("\n") !== before, "reshuffle stems");
    assert(problemsEl.querySelectorAll(".card").length === 10, "reshuffle count");

    document.querySelector("[data-unit='quad']").click();
    assert(state.unitId === "quad", "unit switch");
    assert(document.querySelector("h1").textContent === "一元二次方程式", "quad heading");
    assert(problemsEl.querySelectorAll(".card").length === 10, "quad count");
    assert(problemsEl.querySelectorAll(".stem .katex").length === 10, "quad katex");

    document.querySelector("[data-action='today']").click();
    assert(state.date === todayIso(), "today");
    assert(document.querySelector("[data-action='next']").disabled, "next disabled");
    const todayDate = state.date;
    document.querySelector("[data-action='prev']").click();
    assert(state.date === addDays(todayDate, -1), "prev day");
    assert(state.unitId === unitForDate(state.date).id, "prev unit follows the day");

    box.hidden = false;
    box.dataset.status = "pass";
    box.textContent = [
      "SELFTEST pass",
      `date=${openedOn}`,
      `unit=${openedUnit}`,
      "cards=10",
      "mix=2/6/2",
      "correct=10",
      "wrongRejected=1",
      "katex=10",
      "print=blank,key",
      "reshuffle=1",
      "unitSwitch=quad",
      "dateNav=1",
    ].join("\n");
  } catch (error) {
    box.hidden = false;
    box.dataset.status = "fail";
    box.textContent = `SELFTEST fail\n${error && error.stack ? error.stack : error}`;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

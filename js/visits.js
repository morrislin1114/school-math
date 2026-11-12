const HOST = "morrislin1114.github.io";
const API = "https://countapi.mileshilliard.com/api/v1";
const PEOPLE_KEY = "morrislin1114-school-math-people";
const OPENS_KEY = "morrislin1114-school-math-opens";
const PERSON = "school-math-person";
const OPEN = "school-math-open";

export function recordVisit() {
  if (location.hostname !== HOST) return;
  if (new URLSearchParams(location.search).get("selftest") === "1") return;
  countPeople().catch(() => {});
  countOpen().catch(() => {});
}

export async function readCounts() {
  const [people, opens] = await Promise.all([readKey(PEOPLE_KEY), readKey(OPENS_KEY)]);
  return { people, opens };
}

async function countPeople() {
  if (localStorage.getItem(PERSON)) return;
  await hit(PEOPLE_KEY);
  localStorage.setItem(PERSON, "1");
}

async function countOpen() {
  if (sessionStorage.getItem(OPEN)) return;
  await hit(OPENS_KEY);
  sessionStorage.setItem(OPEN, "1");
}

async function hit(key) {
  const response = await fetch(`${API}/hit/${key}`);
  if (!response.ok) throw new Error("寫入參觀紀錄失敗");
}

async function readKey(key) {
  const response = await fetch(`${API}/get/${key}`);
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error("讀不到參觀紀錄");
  const data = await response.json();
  const value = Number(data.value);
  if (!Number.isFinite(value)) throw new Error("參觀紀錄格式不對");
  return value;
}

import { readCounts } from "./visits.js";

const peopleEl = document.getElementById("people");
const opensEl = document.getElementById("opens");
const errorEl = document.getElementById("error");

document.getElementById("reload").addEventListener("click", load);
load();

async function load() {
  errorEl.hidden = true;
  try {
    const counts = await readCounts();
    peopleEl.textContent = counts.people.toLocaleString("zh-TW");
    opensEl.textContent = `開啟 ${counts.opens.toLocaleString("zh-TW")} 次`;
  } catch (error) {
    peopleEl.textContent = "—";
    opensEl.textContent = "";
    errorEl.hidden = false;
    errorEl.textContent = error instanceof Error ? error.message : "讀不到參觀紀錄";
  }
}

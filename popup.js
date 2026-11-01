const $ = (id) => document.getElementById(id);
const msgEl = $("msg"), countEl = $("count"), delayEl = $("delay");
const startBtn = $("start"), stopBtn = $("stop"), statusEl = $("status");
const emojisEl = $("emojis");
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function emojiPool() {
  return [...new Set([...segmenter.segment(emojisEl.value)]
    .map(({ segment }) => segment)
    .filter((segment) => /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment)))];
}

function updateEmojiInfo() {
  const count = emojiPool().length;
  $("emoji-info").textContent = count === 0 ? "No emojis selected: text only."
    : count < 3 ? `${count} different emoji(s). Add ${3 - count} more to start.`
    : `${count} different emojis saved. 3 chosen for each message.`;
}

const tabs = [$("message-tab"), $("emoji-tab")];
function selectTab(selected) {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !active;
  }
}
for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[1] : tabs.find((item) => item !== tab);
    selectTab(next);
    next.focus();
  });
}
emojisEl.addEventListener("input", () => {
  chrome.storage.local.set({ emojis: emojisEl.value });
  updateEmojiInfo();
});

function setStatus(text, isErr = false) {
  statusEl.textContent = text;
  statusEl.className = isErr ? "err" : "";
}

function setRunning(running) {
  startBtn.style.display = running ? "none" : "block";
  stopBtn.style.display = running ? "block" : "none";
}

chrome.storage.local.get(["msg", "count", "delaySec", "emojis"], (d) => {
  if (d.msg) msgEl.value = d.msg;
  if (d.count) countEl.value = d.count;
  if (d.delaySec) delayEl.value = d.delaySec;
  emojisEl.value = d.emojis || "";
  updateEmojiInfo();
});

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(tab, payload) {
  try {
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch {
    // Content script not injected yet (tab was open before install) - inject and retry.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return await chrome.tabs.sendMessage(tab.id, payload);
  }
}

startBtn.addEventListener("click", async () => {
  const text = msgEl.value.trim();
  const count = parseInt(countEl.value, 10);
  const MAX_COUNT = 100, MIN_DELAY = 1;
  const seconds = Math.max(MIN_DELAY, parseFloat(delayEl.value) || MIN_DELAY);
  const delay = Math.round(seconds * 1000);
  if (!text) return setStatus("Enter a message.", true);
  if (!count || count < 1) return setStatus("Enter a valid count.", true);
  if (count > MAX_COUNT) return setStatus(`Up to ${MAX_COUNT} messages at a time.`, true);
  const emojis = emojiPool();
  if (emojisEl.value.trim() && emojis.length < 3) {
    selectTab($("emoji-tab"));
    return setStatus("Add at least 3 different emojis, or clear the emoji list.", true);
  }

  chrome.storage.local.set({ msg: msgEl.value, count, delaySec: seconds });

  const tab = await getTab();
  if (!tab?.url?.startsWith("https://www.tiktok.com/messages")) {
    return setStatus("Open a chat on tiktok.com/messages first.", true);
  }

  const res = await send(tab, { type: "START", text, count, delay, emojis });
  if (res?.error) return setStatus(res.error, true);
  setRunning(true);
  setStatus(`Sending 0 / ${count}...`);
});

stopBtn.addEventListener("click", async () => {
  const tab = await getTab();
  await send(tab, { type: "STOP" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((m) => {
  if (m.type === "PROGRESS") setStatus(`Sending ${m.sent} / ${m.total}...`);
  if (m.type === "DONE") { setRunning(false); setStatus(`Done: sent ${m.sent} / ${m.total}.`); }
  if (m.type === "ERROR") { setRunning(false); setStatus(m.error, true); }
});

// Restore UI if a run is already in progress when the popup reopens.
(async () => {
  const tab = await getTab();
  if (!tab?.url?.startsWith("https://www.tiktok.com/")) return;
  const res = await send(tab, { type: "STATUS" }).catch(() => null);
  if (res?.running) { setRunning(true); setStatus(`Sending ${res.sent} / ${res.total}...`); }
})();

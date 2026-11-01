(() => {
  if (window.__ttSenderLoaded) return;
  window.__ttSenderLoaded = true;

  const state = { running: false, stop: false, sent: 0, total: 0 };
  // Heartburst is for one person who will be happy to get it, not for flooding chats.
  const MAX_COUNT = 100;
  const MIN_DELAY_MS = 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function findPlaceholder() {
    // TikTok sometimes renders a "Send a message..." placeholder that only becomes editable once clicked.
    const els = document.querySelectorAll('[placeholder], [data-placeholder], [aria-placeholder], div, span');
    for (const el of els) {
      const ph = el.getAttribute("placeholder") || el.getAttribute("data-placeholder") || el.getAttribute("aria-placeholder") || "";
      if (/send a message/i.test(ph)) return el;
      if (el.childElementCount === 0 && /^send a message/i.test((el.textContent || "").trim())) return el;
    }
    return null;
  }

  // Dispatch events straight onto the element, so overlays from other extensions can't intercept them.
  function directClick(el) {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  async function activateEditor() {
    let editor = findEditor();
    if (editor) return editor;
    const ph = findPlaceholder();
    if (!ph) return null;
    directClick(ph);
    for (let i = 0; i < 10 && !editor; i++) {
      await sleep(100);
      editor = findEditor();
    }
    return editor;
  }

  function findEditor() {
    return (
      document.querySelector('textarea[placeholder*="message" i]') ||
      document.querySelector('[data-e2e="message-input-area"] [contenteditable="true"]') ||
      document.querySelector('[class*="DivEditorContainer"] [contenteditable="true"]') ||
      document.querySelector('[class*="DivInputAreaContainer"] [contenteditable="true"]') ||
      document.querySelector('.public-DraftEditor-content[contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"][role="textbox"]') ||
      document.querySelector('[contenteditable="true"]')
    );
  }

  function findSendButton() {
    return (
      document.querySelector('[data-e2e="message-send"]') ||
      document.querySelector('[class*="StyledSendButton"]')
    );
  }

  function editorText(el) {
    const v = el.tagName === "TEXTAREA" ? el.value : el.innerText;
    return (v || "").replace(/​/g, "").trim();
  }

  async function typeText(editor, text) {
    directClick(editor);
    editor.focus();
    if (editor.tagName === "TEXTAREA") {
      // React-controlled textarea: use the native setter so React sees the change.
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(editor, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // Draft.js ignores raw DOM edits; it only updates its state from paste / textInput / beforeinput events.
      // Try each method, checking after each one whether the editor actually accepted the text.
      const methods = [pasteText, textInputEvent, beforeInputEvent, execInsert];
      for (const method of methods) {
        selectAll(editor);
        method(editor, text);
        await sleep(200);
        const ed = findEditor() || editor;
        if (accepted(ed, text)) return;
        clearEditor(ed);
        await sleep(100);
      }
      throw new Error("TikTok's chat box did not accept the text. Reload the page and try again.");
    }
    await sleep(150);
  }

  function selectAll(editor) {
    editor.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function clearEditor(editor) {
    selectAll(editor);
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", keyCode: 8, which: 8, bubbles: true, cancelable: true }));
    document.execCommand("delete", false, null);
  }

  function placeholderVisible(editor) {
    const root = editor.closest(".DraftEditor-root") || editor.parentElement?.parentElement || document;
    const ph = root.querySelector(".public-DraftEditorPlaceholder-root, [class*='Placeholder']");
    return !!(ph && ph.offsetParent !== null && /send a message/i.test(ph.textContent || ""));
  }

  function accepted(editor, text) {
    const firstWord = text.split(/\s+/)[0].slice(0, 5);
    return editorText(editor).includes(firstWord) && !placeholderVisible(editor);
  }

  function pasteText(editor, text) {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }

  function textInputEvent(editor, text) {
    const ev = document.createEvent("TextEvent");
    ev.initTextEvent("textInput", true, true, window, text);
    editor.dispatchEvent(ev);
  }

  function beforeInputEvent(editor, text) {
    editor.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true }));
  }

  function execInsert(editor, text) {
    document.execCommand("insertText", false, text);
  }

  function pressEnter(editor) {
    const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    editor.dispatchEvent(new KeyboardEvent("keydown", opts));
    editor.dispatchEvent(new KeyboardEvent("keypress", opts));
    editor.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  async function sendOnce(text) {
    const editor = await activateEditor();
    if (!editor) throw new Error("Chat input not found. Open a conversation first.");

    await typeText(editor, text);
    if (!editorText(editor)) throw new Error("Could not type into the chat box.");

    const btn = findSendButton();
    if (btn) directClick(btn);
    else pressEnter(editor);

    // Wait for the input to clear (= sent); fall back to Enter if the click did nothing.
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      const ed = findEditor() || editor;
      if (!editorText(ed)) return;
      if (i === 5) pressEnter(ed);
    }
    throw new Error("Message did not send (input never cleared).");
  }

  function report(msg) {
    chrome.runtime.sendMessage(msg).catch(() => {}); // popup may be closed
  }

  function withRandomEmojis(text, emojis) {
    if (!emojis.length) return text;
    const pool = [...emojis];
    for (let i = 0; i < 3; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return `${text}${pool.slice(0, 3).join("")}`;
  }

  async function run(text, count, delay, emojis) {
    Object.assign(state, { running: true, stop: false, sent: 0, total: count });
    try {
      for (let i = 0; i < count && !state.stop; i++) {
        await sendOnce(withRandomEmojis(text, emojis));
        state.sent++;
        report({ type: "PROGRESS", sent: state.sent, total: count });
        if (i < count - 1) await sleep(delay);
      }
      report({ type: "DONE", sent: state.sent, total: count });
    } catch (e) {
      report({ type: "ERROR", error: `${e.message} (sent ${state.sent} / ${count})` });
    } finally {
      state.running = false;
    }
  }

  chrome.runtime.onMessage.addListener((m, _sender, reply) => {
    if (m.type === "START") {
      if (state.running) return reply({ error: "Already sending." });
      const emojis = Array.isArray(m.emojis)
        ? [...new Set(m.emojis.filter((emoji) => typeof emoji === "string" && emoji.trim()))] : [];
      if (emojis.length > 0 && emojis.length < 3) return reply({ error: "Add at least 3 different emojis." });
      activateEditor().then((ed) => {
        if (!ed) return reply({ error: "Chat input not found. Open a conversation first." });
        const count = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(m.count)) || 1));
        const delay = Math.max(MIN_DELAY_MS, Number(m.delay) || MIN_DELAY_MS);
        run(m.text, count, delay, emojis);
        reply({ ok: true });
      });
      return true; // async reply
    } else if (m.type === "STOP") {
      state.stop = true;
      reply({ ok: true });
    } else if (m.type === "STATUS") {
      reply({ running: state.running, sent: state.sent, total: state.total });
    }
  });
})();

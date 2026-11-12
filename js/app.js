import { getPassage } from "./texts.js";
import { TypingEngine } from "./typing-engine.js";
import { clearHistory, getHistory, getSettings, saveSettings, saveTest } from "./storage.js";
import { createLineChart, createPaceChart, loadChartLibrary } from "./charts.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const body = document.body;

function showToast(message) {
  let toast = $("#app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("visible"), 4200);
}

function applySettings() {
  const settings = getSettings();
  const theme = ["midnight", "ocean", "forest", "sunset", "minimal"].includes(settings.theme) ? settings.theme : "midnight";
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = settings.mode === "light" || settings.mode === "dark" ? settings.mode : prefersDark ? "dark" : "light";
  body.dataset.theme = theme;
  body.dataset.mode = mode;
  const themeSelect = $("#theme-select");
  if (themeSelect) themeSelect.value = theme;
}

function initThemeControls() {
  const themeSelect = $("#theme-select");
  const toggle = $("#theme-toggle");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      body.dataset.theme = themeSelect.value;
      try { saveSettings({ theme: themeSelect.value }); } catch (error) { showToast(error.message); }
      if (body.dataset.page === "progress") renderProgressCharts(getHistory());
    });
  }
  if (toggle) {
    toggle.addEventListener("click", () => {
      body.dataset.mode = body.dataset.mode === "dark" ? "light" : "dark";
      try { saveSettings({ mode: body.dataset.mode }); } catch (error) { showToast(error.message); }
      if (body.dataset.page === "progress") renderProgressCharts(getHistory());
    });
  }
}

function initTestPage() {
  const passageNode = $("#passage");
  const area = $("#typing-area");
  const mobileInput = $("#mobile-input");
  const durationButtons = $$("#duration-options [data-duration]");
  const difficultySelect = $("#difficulty-select");
  const customText = $("#custom-text");
  const resultsPanel = $("#results-panel");
  const keyboard = $("#keyboard-visualizer");
  let duration = 30;
  let engine;
  let characterNodes = [];
  let previousWordRange = null;
  let audioContext;
  let lastTabAt = 0;

  const updateLiveStats = (stats) => {
    $("#live-wpm").textContent = String(Math.round(stats.wpm));
    $("#live-raw-wpm").textContent = String(Math.round(stats.rawWpm));
    $("#live-accuracy").innerHTML = `${Math.round(stats.accuracy)}<span class="stat-unit">%</span>`;
    $("#live-errors").textContent = String(stats.incorrect);
    $("#live-time").innerHTML = `${Math.ceil(stats.remaining)}<span class="stat-unit">s</span>`;
    $("#progress-label").textContent = `${engine ? engine.index : 0} / ${characterNodes.length} characters`;
  };

  const wordRangeAt = (index) => {
    if (!characterNodes.length || index >= characterNodes.length || /\s/.test(passageNode.textContent[index])) return null;
    const text = passageNode.textContent;
    let start = index;
    let end = index;
    while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
    while (end < text.length && !/\s/.test(text[end])) end += 1;
    return { start, end };
  };

  const applyWordHighlight = (index) => {
    const nextRange = wordRangeAt(index);
    if (previousWordRange && (!nextRange || previousWordRange.start !== nextRange.start || previousWordRange.end !== nextRange.end)) {
      for (let i = previousWordRange.start; i < previousWordRange.end; i += 1) characterNodes[i].classList.remove("current-word");
    }
    if (nextRange && (!previousWordRange || previousWordRange.start !== nextRange.start || previousWordRange.end !== nextRange.end)) {
      for (let i = nextRange.start; i < nextRange.end; i += 1) characterNodes[i].classList.add("current-word");
    }
    previousWordRange = nextRange;
  };

  const setCaret = (previousIndex, currentIndex) => {
    if (previousIndex < characterNodes.length) characterNodes[previousIndex].classList.remove("current");
    if (currentIndex < characterNodes.length) characterNodes[currentIndex].classList.add("current");
    applyWordHighlight(currentIndex);
    if (currentIndex < characterNodes.length) {
      const current = characterNodes[currentIndex];
      const box = area.getBoundingClientRect();
      const currentBox = current.getBoundingClientRect();
      if (currentBox.bottom > box.bottom - 22 || currentBox.top < box.top + 10) {
        current.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  };

  const renderPassage = (text) => {
    const fragment = document.createDocumentFragment();
    characterNodes = Array.from(text, (character) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = character;
      fragment.append(span);
      return span;
    });
    passageNode.replaceChildren(fragment);
    previousWordRange = null;
    if (characterNodes.length) {
      characterNodes[0].classList.add("current");
      applyWordHighlight(0);
    }
  };

  const playSound = (isError) => {
    if (!$("#sound-toggle").checked) return;
    try {
      audioContext = audioContext || new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = isError ? 190 : 520;
      gain.gain.value = isError ? .035 : .014;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + (isError ? .09 : .025));
    } catch (error) {
      console.warn("KeySprint could not play the optional key sound.", error);
    }
  };

  const renderResults = async (result, mode, difficulty) => {
    const history = getHistory();
    const previousBest = history.reduce((best, entry) => Math.max(best, Number(entry.wpm) || 0), 0);
    const isBest = result.wpm > previousBest;
    const finalResult = { ...result, mode, difficulty };
    try {
      saveTest(finalResult);
    } catch (error) {
      showToast(error.message);
    }

    resultsPanel.hidden = false;
    $("#best-badge").hidden = !isBest;
    animateNumber($("#result-accuracy"), Math.round(result.accuracy), "%");
    animateNumber($("#result-consistency"), Math.round(result.consistency), "%");
    animateNumber($("#result-correct"), result.correct);
    animateNumber($("#result-incorrect"), result.incorrect);
    animateNumber($("#result-missed"), result.missed);
    animateNumber($("#result-raw-wpm"), Math.round(result.rawWpm));
    animateNumber($("#result-wpm"), Math.round(result.wpm));
    resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      await loadChartLibrary();
      createPaceChart($("#result-chart"), result.seconds);
    } catch (error) {
      showToast(error.message);
    }
    if (isBest) launchConfetti();
  };

  const initializeTest = (focusInput = false) => {
    duration = Number($(".segment.selected", $("#duration-options"))?.dataset.duration || 30);
    const custom = customText.value.trim();
    const difficulty = difficultySelect.value;
    const selected = custom
      ? { text: custom, label: "CUSTOM · YOUR TEXT" }
      : getPassage(difficulty, duration);
    const usableText = Array.from(selected.text).slice(0, 10000).join("");
    if (!usableText.trim()) {
      showToast("Add some text before starting a custom test.");
      return;
    }
    renderPassage(usableText);
    $("#passage-label").textContent = selected.label;
    $("#live-wpm").textContent = "0";
    $("#live-raw-wpm").textContent = "0";
    $("#live-accuracy").innerHTML = '100<span class="stat-unit">%</span>';
    $("#live-errors").textContent = "0";
    $("#live-time").innerHTML = `${duration}<span class="stat-unit">s</span>`;
    $("#progress-label").textContent = `0 / ${characterNodes.length} characters`;
    $("#test-status").textContent = "Ready when you are";
    $(".typing-status").classList.remove("running");
    resultsPanel.hidden = true;
    if (mobileInput) mobileInput.value = "";
    engine = new TypingEngine({
      text: usableText,
      duration,
      onUpdate: (event) => {
        updateLiveStats(event.stats);
        if (event.type === "state") {
          const running = event.state === "running";
          $(".typing-status").classList.toggle("running", running);
          $("#test-status").textContent = running ? "In the zone..." : event.state === "paused" ? "Paused · window not focused" : event.state === "done" ? "Test complete" : "Ready when you are";
        }
        if (event.type === "character") {
          const node = characterNodes[event.changedIndex];
          node.classList.add(event.correct ? "correct" : "incorrect");
          playSound(!event.correct);
          setCaret(event.previousIndex, event.currentIndex);
        } else if (event.type === "backspace") {
          const node = characterNodes[event.changedIndex];
          node.classList.remove("correct", "incorrect");
          setCaret(event.previousIndex, event.currentIndex);
        }
      },
      onFinish: (result) => {
        $("#test-status").textContent = "Test complete";
        $(".typing-status").classList.remove("running");
        const mode = custom ? "Custom" : `${duration}s`;
        renderResults(result, mode, custom ? "custom" : difficulty);
      }
    });
    if (focusInput) {
      if (window.matchMedia("(max-width: 620px)").matches) mobileInput.focus({ preventScroll: true });
      else area.focus({ preventScroll: true });
    }
  };

  const handleKeyDown = (event) => {
    if (event.target === mobileInput) {
      if (event.key === "Backspace") {
        event.preventDefault();
        engine.handleBackspace();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      engine.handleBackspace();
    } else if (event.key === "Enter" && engine.text[engine.index] === "\n") {
      event.preventDefault();
      engine.handleCharacter("\n");
    } else if (Array.from(event.key).length === 1) {
      event.preventDefault();
      engine.handleCharacter(event.key);
    }
  };

  durationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      durationButtons.forEach((item) => item.classList.toggle("selected", item === button));
      initializeTest();
    });
  });
  difficultySelect.addEventListener("change", () => initializeTest());
  $("#start-button").addEventListener("click", () => initializeTest(true));
  $("#restart-button").addEventListener("click", () => initializeTest(true));
  $("#again-button").addEventListener("click", () => initializeTest(true));
  $("#close-results").addEventListener("click", () => { resultsPanel.hidden = true; });
  area.addEventListener("keydown", handleKeyDown);
  area.addEventListener("paste", (event) => event.preventDefault());
  area.addEventListener("drop", (event) => event.preventDefault());
  mobileInput.addEventListener("paste", (event) => event.preventDefault());
  mobileInput.addEventListener("input", () => {
    const value = mobileInput.value;
    mobileInput.value = "";
    for (const character of value) {
      if (character === "\r") continue;
      engine.handleCharacter(character);
    }
  });
  area.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 620px)").matches) mobileInput.focus({ preventScroll: true });
    else area.focus({ preventScroll: true });
  });
  $("#keyboard-toggle").addEventListener("change", (event) => keyboard.classList.toggle("is-hidden", !event.target.checked));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab") lastTabAt = Date.now();
    if (event.key === "Enter" && Date.now() - lastTabAt < 1000) {
      event.preventDefault();
      initializeTest(true);
      lastTabAt = 0;
    }
  });
  window.addEventListener("keydown", (event) => highlightKey(event.key, true));
  window.addEventListener("keyup", (event) => highlightKey(event.key, false));
  window.addEventListener("blur", () => engine && engine.pause());
  window.addEventListener("focus", () => engine && engine.resume());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) engine && engine.pause();
    else if (document.hasFocus()) engine && engine.resume();
  });

  initializeTest();

  function highlightKey(key, active) {
    const normalized = key.length === 1 ? key.toLowerCase() : key.toLowerCase();
    const keyName = normalized === " " ? " " : normalized === "enter" ? "enter" : normalized === "shift" ? "shift" : normalized;
    const visualKey = $(`.keyboard-key[data-key="${CSS.escape(keyName)}"]`, keyboard);
    if (!visualKey) return;
    visualKey.classList.toggle("active", active);
    if (active) window.setTimeout(() => visualKey.classList.remove("active"), 160);
  }
}

function animateNumber(node, target, suffix = "") {
  const start = performance.now();
  const duration = 650;
  const update = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    node.textContent = `${Math.round(target * (1 - (1 - progress) ** 3))}${suffix}`;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function launchConfetti() {
  const layer = $("#confetti-layer");
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 36; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    fragment.append(piece);
  }
  layer.replaceChildren(fragment);
  window.setTimeout(() => layer.replaceChildren(), 3000);
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const total = value > 0 ? Math.max(1, Math.round(value)) : 0;
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function renderProgressCharts(history) {
  const chronological = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = chronological.map((entry) => new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  createLineChart($("#history-wpm-chart"), labels, chronological.map((entry) => Number(entry.wpm) || 0));
  createLineChart($("#history-accuracy-chart"), labels, chronological.map((entry) => Number(entry.accuracy) || 0), {
    color: getComputedStyle(body).getPropertyValue("--secondary").trim(),
    percent: true
  });
}

function initProgressPage() {
  const tableBody = $("#history-body");
  const search = $("#history-search");
  const sort = $("#sort-history");
  const emptyState = $("#empty-history");
  const dialog = $("#confirm-dialog");
  let chartLoadPromise = null;

  const renderHistory = (updateCharts = false) => {
    const fullHistory = getHistory();
    const query = search.value.trim().toLowerCase();
    const visible = fullHistory.filter((entry) => `${entry.mode} ${entry.difficulty}`.toLowerCase().includes(query));
    const sorters = {
      newest: (a, b) => new Date(b.date) - new Date(a.date),
      oldest: (a, b) => new Date(a.date) - new Date(b.date),
      wpm: (a, b) => (Number(b.wpm) || 0) - (Number(a.wpm) || 0),
      accuracy: (a, b) => (Number(b.accuracy) || 0) - (Number(a.accuracy) || 0)
    };
    visible.sort(sorters[sort.value] || sorters.newest);
    const fragment = document.createDocumentFragment();
    visible.forEach((entry) => {
      const row = document.createElement("tr");
      const date = new Date(entry.date);
      const values = [
        Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
        entry.mode || "—",
        entry.difficulty || "—",
        `${Math.round(Number(entry.wpm) || 0)} WPM`,
        `${Math.round(Number(entry.accuracy) || 0)}%`,
        formatDuration(entry.elapsed)
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        if (index === 2) {
          const chip = document.createElement("span");
          chip.className = "difficulty-chip";
          chip.textContent = String(value);
          cell.append(chip);
        } else cell.textContent = String(value);
        row.append(cell);
      });
      fragment.append(row);
    });
    tableBody.replaceChildren(fragment);
    emptyState.hidden = visible.length > 0;
    emptyState.textContent = fullHistory.length === 0
      ? "No tests yet. Your practice sessions will show up here."
      : "No tests match your search.";
    $(".table-wrap").hidden = visible.length === 0;
    renderSummary(fullHistory);
    if (updateCharts) {
      if (window.Chart) renderProgressCharts(fullHistory);
      else if (!chartLoadPromise) {
        chartLoadPromise = loadChartLibrary()
          .then(() => renderProgressCharts(getHistory()))
          .catch((error) => showToast(error.message));
      }
    }
  };

  search.addEventListener("input", renderHistory);
  sort.addEventListener("change", renderHistory);
  $("#clear-history").addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "confirm") return;
    try {
      clearHistory();
      renderHistory(true);
      showToast("Your test history has been cleared.");
    } catch (error) {
      showToast(error.message);
    }
  });
  renderHistory(true);
}

function renderSummary(history) {
  const wpmValues = history.map((entry) => Number(entry.wpm) || 0);
  const best = wpmValues.length ? Math.max(...wpmValues) : null;
  const average = wpmValues.length ? wpmValues.reduce((sum, value) => sum + value, 0) / wpmValues.length : null;
  const recent = [...history].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-10);
  let improvement = null;
  if (recent.length >= 2) {
    const first = Number(recent[0].wpm) || 0;
    const last = Number(recent[recent.length - 1].wpm) || 0;
    improvement = first ? ((last - first) / first) * 100 : 0;
  }
  $("#summary-best").textContent = best === null ? "—" : String(Math.round(best));
  $("#summary-average").textContent = average === null ? "—" : String(Math.round(average));
  $("#summary-tests").textContent = String(history.length);
  $("#summary-time").textContent = formatDuration(history.reduce((sum, entry) => sum + (Number(entry.elapsed) || 0), 0));
  $("#summary-improvement").textContent = improvement === null ? "—" : `${improvement > 0 ? "+" : ""}${Math.round(improvement)}%`;
}

applySettings();
initThemeControls();
if (body.dataset.page === "test") initTestPage();
if (body.dataset.page === "progress") initProgressPage();

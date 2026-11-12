const HISTORY_KEY = "keysprint.history.v1";
const SETTINGS_KEY = "keysprint.settings.v1";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`KeySprint could not read local storage key "${key}".`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`KeySprint could not save local storage key "${key}".`, error);
    throw new Error("Your browser could not save this session. Check your storage settings and try again.");
  }
}

export function getHistory() {
  const history = readJSON(HISTORY_KEY, []);
  return Array.isArray(history) ? history.filter((entry) => entry && typeof entry === "object") : [];
}

export function saveTest(test) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    mode: String(test.mode),
    difficulty: String(test.difficulty),
    duration: Number(test.duration) || 0,
    elapsed: Number(test.elapsed) || 0,
    wpm: Number(test.wpm) || 0,
    rawWpm: Number(test.rawWpm) || 0,
    accuracy: Number(test.accuracy) || 0,
    consistency: Number(test.consistency) || 0,
    correct: Number(test.correct) || 0,
    incorrect: Number(test.incorrect) || 0,
    missed: Number(test.missed) || 0,
    seconds: Array.isArray(test.seconds) ? test.seconds : []
  };
  const history = getHistory();
  history.push(entry);
  writeJSON(HISTORY_KEY, history);
  return entry;
}

export function clearHistory() {
  writeJSON(HISTORY_KEY, []);
}

export function getSettings() {
  const settings = readJSON(SETTINGS_KEY, {});
  return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
}

export function saveSettings(updates) {
  writeJSON(SETTINGS_KEY, { ...getSettings(), ...updates });
}

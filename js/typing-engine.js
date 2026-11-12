export class TypingEngine {
  constructor({ text, duration, onUpdate, onFinish }) {
    this.text = text;
    this.duration = duration;
    this.onUpdate = onUpdate;
    this.onFinish = onFinish;
    this.typed = [];
    this.startedAt = null;
    this.elapsedBeforePause = 0;
    this.timer = null;
    this.state = "ready";
    this.keyPresses = 0;
    this.secondSamples = [];
    this.lastSampleSecond = 0;
    this.lastSampleCorrect = 0;
  }

  get index() {
    return this.typed.length;
  }

  handleCharacter(character) {
    if (this.state === "done" || !character || this.index >= this.text.length) return false;
    if (this.state === "ready") this.start();
    if (this.state === "paused") this.resume();
    const index = this.index;
    this.typed.push(character);
    this.keyPresses += 1;
    this.onUpdate({
      type: "character",
      changedIndex: index,
      previousIndex: index,
      currentIndex: this.index,
      character,
      correct: character === this.text[index],
      stats: this.getStats()
    });
    if (this.index >= this.text.length) this.finish();
    return true;
  }

  handleBackspace() {
    if (this.state === "done" || this.index === 0) return false;
    const previousIndex = this.index;
    this.typed.pop();
    this.onUpdate({
      type: "backspace",
      changedIndex: this.index,
      previousIndex,
      currentIndex: this.index,
      stats: this.getStats()
    });
    return true;
  }

  start() {
    this.state = "running";
    this.startedAt = performance.now();
    this.timer = window.setInterval(() => this.tick(), 100);
    this.onUpdate({ type: "state", state: this.state, stats: this.getStats() });
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    this.startedAt = performance.now();
    this.timer = window.setInterval(() => this.tick(), 100);
    this.onUpdate({ type: "state", state: this.state, stats: this.getStats() });
  }

  pause() {
    if (this.state !== "running") return;
    this.elapsedBeforePause += performance.now() - this.startedAt;
    this.startedAt = null;
    window.clearInterval(this.timer);
    this.timer = null;
    this.state = "paused";
    this.onUpdate({ type: "state", state: this.state, stats: this.getStats() });
  }

  getElapsedMs() {
    if (this.state === "running") return this.elapsedBeforePause + performance.now() - this.startedAt;
    return this.elapsedBeforePause;
  }

  getStats() {
    const elapsed = this.getElapsedMs() / 1000;
    const minutes = Math.max(elapsed / 60, 1 / 3600);
    let correct = 0;
    for (let i = 0; i < this.typed.length; i += 1) {
      if (this.typed[i] === this.text[i]) correct += 1;
    }
    const incorrect = this.typed.length - correct;
    const accuracy = this.keyPresses ? (correct / this.keyPresses) * 100 : 100;
    const wpm = elapsed ? (correct / 5) / minutes : 0;
    const rawWpm = elapsed ? (this.keyPresses / 5) / minutes : 0;
    return {
      elapsed,
      remaining: Math.max(0, this.duration - elapsed),
      correct,
      incorrect,
      missed: Math.max(0, this.text.length - this.index),
      keyPresses: this.keyPresses,
      accuracy,
      wpm,
      rawWpm
    };
  }

  tick() {
    if (this.state !== "running") return;
    const stats = this.getStats();
    const wholeSecond = Math.floor(stats.elapsed);
    if (wholeSecond > this.lastSampleSecond) {
      const interval = wholeSecond - this.lastSampleSecond;
      const correct = this.getCorrectCount();
      const wpm = ((correct - this.lastSampleCorrect) / interval / 5) * 60;
      while (this.lastSampleSecond < wholeSecond) {
        this.lastSampleSecond += 1;
        this.secondSamples.push({ second: this.lastSampleSecond, wpm });
      }
      this.lastSampleCorrect = correct;
    }
    this.onUpdate({ type: "tick", stats });
    if (stats.remaining <= 0) this.finish();
  }

  getCorrectCount() {
    let correct = 0;
    for (let i = 0; i < this.typed.length; i += 1) {
      if (this.typed[i] === this.text[i]) correct += 1;
    }
    return correct;
  }

  finish() {
    if (this.state === "done") return;
    if (this.state === "running") this.elapsedBeforePause += performance.now() - this.startedAt;
    this.startedAt = null;
    window.clearInterval(this.timer);
    this.timer = null;
    this.state = "done";
    const stats = this.getStats();
    const values = this.secondSamples.map((sample) => sample.wpm).filter(Number.isFinite);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : stats.wpm;
    const variance = values.length ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length : 0;
    const consistency = mean ? Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / mean) * 100)) : 0;
    this.onUpdate({ type: "state", state: this.state, stats });
    this.onFinish({
      ...stats,
      consistency,
      seconds: this.secondSamples,
      typed: [...this.typed],
      duration: this.duration
    });
  }
}

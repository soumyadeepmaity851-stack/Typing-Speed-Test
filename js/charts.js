let chartLibraryPromise;

export function loadChartLibrary() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLibraryPromise) return chartLibraryPromise;
  chartLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error("Chart.js could not be loaded. Check your internet connection."));
    document.head.append(script);
  });
  return chartLibraryPromise;
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    accent: styles.getPropertyValue("--accent").trim() || "#a78bfa",
    secondary: styles.getPropertyValue("--secondary").trim() || "#63d7c2",
    muted: styles.getPropertyValue("--subtle").trim() || "#737d95",
    grid: styles.getPropertyValue("--line").trim() || "rgba(202, 211, 235, .12)"
  };
}

function replaceChart(canvas, config) {
  if (!canvas || !window.Chart) return null;
  if (canvas._keySprintChart) canvas._keySprintChart.destroy();
  canvas._keySprintChart = new window.Chart(canvas, config);
  return canvas._keySprintChart;
}

function lineOptions(color, percent = false) {
  const colors = chartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: getComputedStyle(document.body).getPropertyValue("--surface-solid").trim(),
        titleColor: getComputedStyle(document.body).getPropertyValue("--text").trim(),
        bodyColor: getComputedStyle(document.body).getPropertyValue("--muted").trim(),
        borderColor: colors.grid,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: { label: (context) => `${context.parsed.y}${percent ? "%" : " WPM"}` }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: colors.muted, maxTicksLimit: 8, maxRotation: 0 } },
      y: {
        beginAtZero: true,
        suggestedMax: percent ? 100 : undefined,
        max: percent ? 100 : undefined,
        border: { display: false },
        grid: { color: colors.grid },
        ticks: { color: colors.muted, maxTicksLimit: 5, callback: (value) => percent ? `${value}%` : value }
      }
    }
  };
}

export function createLineChart(canvas, labels, values, { color, percent = false, fill = true } = {}) {
  const colors = chartColors();
  const stroke = color || colors.accent;
  return replaceChart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: stroke,
        backgroundColor: `${stroke}22`,
        fill,
        tension: .35,
        borderWidth: 2,
        pointRadius: values.length > 18 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: stroke
      }]
    },
    options: lineOptions(stroke, percent)
  });
}

export function createPaceChart(canvas, samples) {
  const colors = chartColors();
  const data = samples && samples.length ? samples : [{ second: 0, wpm: 0 }];
  return createLineChart(canvas, data.map((sample) => `${sample.second}s`), data.map((sample) => Math.round(sample.wpm)), {
    color: colors.secondary,
    fill: true
  });
}

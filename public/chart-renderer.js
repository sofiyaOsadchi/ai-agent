// public/shared/chart-renderer.js
// Loaded as a regular script (not module) into client-reports.html.
// Exposes window.ChartRenderer with: render(canvasId, chartType, result, options).
//
// Supported chart types:
//   - "line"     : original line chart (trend)
//   - "bar"      : original bar chart (trend)
//   - "donut"    : breakdown segments as donut, % shares
//   - "funnel"   : impressions -> clicks -> conversions -> leads stages
//   - "combined" : breakdown segments with bars (primary) + line (secondary)
//
// Assumes Chart.js v4 + chartjs-plugin-datalabels are already loaded by the host page.

(function () {
  "use strict";

  // === Color palette - matches existing client-reports.html ===
  const PALETTE = ["#00B3A4", "#8AB4FF", "#F59E0B", "#22C55E", "#A855F7", "#EF4444", "#14B8A6", "#FBBF24", "#F472B6", "#60A5FA"];

  const FUNNEL_STAGES = [
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clicks" },
    { key: "conversions", label: "Conversions" },
    { key: "leads", label: "Leads" },
  ];

  // === Public API ===

  window.ChartRenderer = {
    render: renderChart,
    destroyInstance: destroyChartInstance,
    getAvailableTypes,
  };

  // החזק את ה-instances הפעילים לפי canvas id כדי שנוכל לעשות destroy לפני re-render.
  const instances = {};

  // === Main entry point ===

  function renderChart(canvasId, chartType, result, options) {
    options = options || {};

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn("ChartRenderer: canvas not found:", canvasId);
      return null;
    }

    destroyChartInstance(canvasId);

    const display = (result && result.dashboardConfig && result.dashboardConfig.display) || {};
    const accent = options.accentColor || display.accentColor || "#00B3A4";
    const numberFormat = display.numberFormat || "short";
    const currency = display.currency || "₪";

    const ctx = {
      canvas,
      result,
      options,
      accent,
      numberFormat,
      currency,
      display,
    };

    let instance = null;

    switch (chartType) {
      case "line":
      case "bar":
        instance = renderTrendChart(ctx, chartType);
        break;
      case "donut":
        instance = renderDonutChart(ctx);
        break;
      case "funnel":
        instance = renderFunnelChart(ctx);
        break;
      case "combined":
        instance = renderCombinedChart(ctx);
        break;
      default:
        console.warn("ChartRenderer: unknown chart type:", chartType);
        return null;
    }

    if (instance) {
      instances[canvasId] = instance;
    }

    return instance;
  }

  function destroyChartInstance(canvasId) {
    if (instances[canvasId]) {
      try {
        instances[canvasId].destroy();
      } catch (e) {
        // לא חשוב אם נכשל - פשוט ננסה לאפס.
      }
      delete instances[canvasId];
    }
  }

  // מחזיר את סוגי הגרפים הזמינים לפי הדאטה.
  // למשל, funnel זמין רק אם יש לפחות 2 stages עם ערכים.
  function getAvailableTypes(result) {
    const available = ["line", "bar", "donut", "combined"];

    const totals = (result && result.totals) || {};
    const funnelStagesWithData = FUNNEL_STAGES.filter((s) => Number(totals[s.key]) > 0);

    if (funnelStagesWithData.length >= 2) {
      available.push("funnel");
    }

    return available;
  }

  // === LINE / BAR (trend chart) ===
  // מחזיר את הלוגיקה המקורית כדי שלא נשבור את ה-trend chart הקיים.

  function renderTrendChart(ctx, chartType) {
    const result = ctx.result;
    const series = (result.chartData && result.chartData.line) || [];
    const labels = (series[0] && series[0].points && series[0].points.map((p) => p.label)) || [];

    const datasets = series.map((s, index) => ({
      label: metricLabel(s.metric),
      data: s.points.map((p) => Number(p.value) || 0),
      borderColor: PALETTE[index % PALETTE.length],
      backgroundColor: withAlpha(PALETTE[index % PALETTE.length], 0.22),
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 3,
      tension: 0.28,
      fill: chartType !== "bar",
      type: chartType === "bar" ? "bar" : "line",
    }));

    return new Chart(ctx.canvas, {
      type: chartType === "bar" ? "bar" : "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: "rgba(255,255,255,0.78)", font: { weight: "bold" } },
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (tt) => {
                const metric = series[tt.datasetIndex] && series[tt.datasetIndex].metric;
                return `${tt.dataset.label}: ${formatMetric(tt.raw, metric, ctx)}`;
              },
            },
          },
          datalabels: {
            display: labels.length <= 12,
            color: "rgba(255,255,255,0.78)",
            anchor: "end",
            align: "top",
            formatter: (value, dlCtx) => {
              const metric = series[dlCtx.datasetIndex] && series[dlCtx.datasetIndex].metric;
              return compactForChart(value, metric, ctx);
            },
            font: { size: 10, weight: "bold" },
          },
        },
        scales: {
          x: {
            ticks: { color: "rgba(255,255,255,0.68)", maxRotation: 0, autoSkip: true },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "rgba(255,255,255,0.72)",
              callback: (value) => compactNumber(value, ctx.numberFormat),
            },
            grid: { color: "rgba(255,255,255,0.1)" },
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }

  // === DONUT ===
  // חלוקת ה-breakdown לפי המטריקה הראשית. כל segment מקבל אחוז.

  function renderDonutChart(ctx) {
    const result = ctx.result;
    const breakdownConfig = (result.dashboardConfig && result.dashboardConfig.breakdownChart) || {};
    const metric = ctx.options.metric || breakdownConfig.metric || "conversions";
    const limit = ctx.options.limit || breakdownConfig.limit || 8;

    const rows = sortRows([...(result.breakdownRows || [])], metric, "desc").slice(0, limit);

    const total = rows.reduce((acc, r) => acc + (Number(r[metric]) || 0), 0);

    const labels = rows.map((r) => r.label);
    const values = rows.map((r) => Number(r[metric]) || 0);
    const colors = rows.map((_, i) => PALETTE[i % PALETTE.length]);

    return new Chart(ctx.canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: "rgba(0,0,0,0.3)",
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "rgba(255,255,255,0.78)",
              font: { size: 11, weight: "bold" },
              padding: 12,
              boxWidth: 14,
            },
          },
          tooltip: {
            callbacks: {
              label: (tt) => {
                const value = tt.raw;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return `${tt.label}: ${formatMetric(value, metric, ctx)} (${pct}%)`;
              },
            },
          },
          datalabels: {
            color: "#ffffff",
            font: { size: 11, weight: "bold" },
            formatter: (value) => {
              if (total === 0) return "";
              const pct = (value / total) * 100;
              return pct >= 5 ? `${pct.toFixed(0)}%` : "";
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }

  // === FUNNEL ===
  // משתמש ב-horizontalBar כל שלב כ-bar. כל bar מציג כמה נשאר ואחוז drop-off.

  function renderFunnelChart(ctx) {
    const result = ctx.result;
    const totals = result.totals || {};

    // רק stages שיש להם ערך > 0.
    const activeStages = FUNNEL_STAGES.filter((s) => Number(totals[s.key]) > 0);

    if (activeStages.length < 2) {
      // לא אמורים להגיע לכאן כי getAvailableTypes חוסם, אבל ליתר ביטחון.
      drawEmptyMessage(ctx.canvas, "Not enough funnel stages in this report.");
      return null;
    }

    const labels = activeStages.map((s) => s.label);
    const values = activeStages.map((s) => Number(totals[s.key]) || 0);
    const topValue = values[0] || 1;

    // צבעים יורדים בעוצמה לפי השלב.
    const colors = activeStages.map((_, i) => withAlpha(ctx.accent, 1 - i * 0.13));

    // labels שמראים את ההמרה משלב לשלב.
    const stageInfo = values.map((value, i) => {
      const pctOfTop = topValue > 0 ? (value / topValue) * 100 : 0;
      const dropoff = i > 0 && values[i - 1] > 0 ? ((values[i - 1] - value) / values[i - 1]) * 100 : null;
      return { value, pctOfTop, dropoff };
    });

    return new Chart(ctx.canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Funnel",
          data: values,
          backgroundColor: colors,
          borderColor: ctx.accent,
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 36,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (tt) => {
                const info = stageInfo[tt.dataIndex];
                const lines = [`${tt.label}: ${formatNumber(tt.raw, ctx.numberFormat)}`, `${info.pctOfTop.toFixed(1)}% of top`];
                if (info.dropoff !== null) {
                  lines.push(`${info.dropoff.toFixed(1)}% drop from previous`);
                }
                return lines;
              },
            },
          },
          datalabels: {
            color: "#ffffff",
            anchor: "center",
            align: "center",
            font: { size: 12, weight: "bold" },
            formatter: (value, dlCtx) => {
              const info = stageInfo[dlCtx.dataIndex];
              return `${compactNumber(value, "short")} (${info.pctOfTop.toFixed(0)}%)`;
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: "rgba(255,255,255,0.72)",
              callback: (value) => compactNumber(value, ctx.numberFormat),
            },
            grid: { color: "rgba(255,255,255,0.1)" },
          },
          y: {
            ticks: {
              color: "rgba(255,255,255,0.85)",
              font: { weight: "bold", size: 12 },
            },
            grid: { display: false },
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }

  // === COMBINED ===
  // bars (primary metric) + line (secondary metric) על אותו x-axis של breakdown.

  function renderCombinedChart(ctx) {
    const result = ctx.result;
    const breakdownConfig = (result.dashboardConfig && result.dashboardConfig.breakdownChart) || {};
    const primaryMetric = ctx.options.primaryMetric || breakdownConfig.metric || "spend";
    const limit = ctx.options.limit || breakdownConfig.limit || 8;

    // ה-secondary metric ייבחר אוטומטית - מטריקה משלימה למטריקה הראשית.
    const secondaryMetric = ctx.options.secondaryMetric || pickSecondaryMetric(primaryMetric, result);

    const rows = sortRows([...(result.breakdownRows || [])], primaryMetric, "desc").slice(0, limit);

    const labels = rows.map((r) => r.label);
    const primaryValues = rows.map((r) => Number(r[primaryMetric]) || 0);
    const secondaryValues = rows.map((r) => Number(r[secondaryMetric]) || 0);

    const secondaryColor = "#FBBF24";

    return new Chart(ctx.canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: metricLabel(primaryMetric),
            data: primaryValues,
            backgroundColor: withAlpha(ctx.accent, 0.75),
            borderColor: ctx.accent,
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: "y",
            order: 2,
          },
          {
            type: "line",
            label: metricLabel(secondaryMetric),
            data: secondaryValues,
            borderColor: secondaryColor,
            backgroundColor: withAlpha(secondaryColor, 0.2),
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.3,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { color: "rgba(255,255,255,0.85)", font: { weight: "bold" } },
          },
          tooltip: {
            callbacks: {
              label: (tt) => {
                const metric = tt.datasetIndex === 0 ? primaryMetric : secondaryMetric;
                return `${tt.dataset.label}: ${formatMetric(tt.raw, metric, ctx)}`;
              },
            },
          },
          datalabels: {
            display: (dlCtx) => dlCtx.datasetIndex === 1, // רק על ה-line, לא על ה-bars (פחות עמוס).
            color: secondaryColor,
            anchor: "end",
            align: "top",
            offset: 4,
            font: { size: 10, weight: "bold" },
            formatter: (value) => compactForChart(value, secondaryMetric, ctx),
          },
        },
        scales: {
          x: {
            ticks: {
              color: "rgba(255,255,255,0.72)",
              maxRotation: 35,
              minRotation: 0,
              callback: function (value) {
                const label = this.getLabelForValue(value);
                return String(label).length > 14 ? String(label).slice(0, 14) + "…" : label;
              },
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          y: {
            beginAtZero: true,
            position: "left",
            ticks: {
              color: ctx.accent,
              callback: (value) => compactNumber(value, ctx.numberFormat),
            },
            grid: { color: "rgba(255,255,255,0.1)" },
            title: {
              display: true,
              text: metricLabel(primaryMetric),
              color: ctx.accent,
              font: { weight: "bold", size: 11 },
            },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            ticks: {
              color: secondaryColor,
              callback: (value) => compactNumber(value, ctx.numberFormat),
            },
            grid: { display: false },
            title: {
              display: true,
              text: metricLabel(secondaryMetric),
              color: secondaryColor,
              font: { weight: "bold", size: 11 },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }

  // === Helpers ===

  function pickSecondaryMetric(primary, result) {
    // לוגיקה פשוטה: מתאים מטריקות לפי קונטקסט.
    const totals = (result && result.totals) || {};
    const pairs = {
      spend: "roas",
      revenue: "roas",
      conversions: "cpa",
      clicks: "ctr",
      leads: "cpl",
      impressions: "ctr",
      sessions: "conversionRate",
    };

    const candidate = pairs[primary] || "roas";

    // ודא שיש דאטה למטריקה הזו, אחרת fallback.
    if (Number(totals[candidate]) > 0) return candidate;

    // fallback - מצא מטריקה כלשהי שיש לה ערך והיא לא ה-primary.
    const fallbackOrder = ["roas", "cpa", "ctr", "conversionRate", "revenue", "spend"];
    for (const m of fallbackOrder) {
      if (m !== primary && Number(totals[m]) > 0) return m;
    }

    return "roas";
  }

  function sortRows(rows, key, direction) {
    const mult = direction === "asc" ? 1 : -1;
    return rows.sort((a, b) => ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * mult);
  }

  function withAlpha(hex, alpha) {
    const clean = String(hex || "#00B3A4").replace("#", "");
    const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const bigint = parseInt(expanded, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function metricLabel(metric) {
    const labels = {
      spend: "Spend",
      impressions: "Impressions",
      clicks: "Clicks",
      ctr: "CTR",
      cpc: "CPC",
      cpm: "CPM",
      conversions: "Conversions",
      conversionRate: "Conv. Rate",
      cpa: "CPA",
      revenue: "Revenue",
      roas: "ROAS",
      leads: "Leads",
      cpl: "CPL",
      sessions: "Sessions",
      users: "Users",
      organicTraffic: "Organic Traffic",
      paidTraffic: "Paid Traffic",
    };
    return labels[metric] || metric;
  }

  function formatMetric(value, metric, ctx) {
    const n = Number(value) || 0;
    const currency = ctx.currency;

    if (["spend", "cpc", "cpm", "cpa", "revenue", "cpl"].indexOf(metric) !== -1) {
      return `${currency}${formatNumber(n, ctx.numberFormat)}`;
    }
    if (["ctr", "conversionRate", "emailOpenRate", "emailClickRate"].indexOf(metric) !== -1) {
      return `${round(n, 2)}%`;
    }
    if (metric === "roas") {
      return `${round(n, 2)}x`;
    }
    return formatNumber(n, ctx.numberFormat);
  }

  function compactForChart(value, metric, ctx) {
    const n = Number(value) || 0;
    if (["ctr", "conversionRate", "emailOpenRate", "emailClickRate"].indexOf(metric) !== -1) {
      return `${round(n, 1)}%`;
    }
    if (metric === "roas") {
      return `${round(n, 1)}x`;
    }
    if (["spend", "cpc", "cpm", "cpa", "revenue", "cpl"].indexOf(metric) !== -1) {
      return `${ctx.currency}${compactNumber(n, "short")}`;
    }
    return compactNumber(n, "short");
  }

  function formatNumber(n, format) {
    if (format === "full") {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
    }
    return compactNumber(n, "short");
  }

  function compactNumber(n, format) {
    const num = Number(n) || 0;
    if (format === "full") {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
    }
    if (Math.abs(num) >= 1000000) return `${round(num / 1000000, 1)}M`;
    if (Math.abs(num) >= 1000) return `${round(num / 1000, 1)}K`;
    return String(round(num, 2));
  }

  function round(n, digits) {
    const factor = Math.pow(10, digits || 2);
    return Math.round((Number(n) || 0) * factor) / factor;
  }

  function drawEmptyMessage(canvas, message) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }
})();
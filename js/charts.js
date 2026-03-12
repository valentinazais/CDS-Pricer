/*
 *  charts.js
 *  Chart.js rendering — clean light theme
 */

var Charts = (function () {

    var instances = {};

    var COLORS = {
        bar:      '#555555',
        barPos:   '#333333',
        barNeg:   '#aaaaaa',
        line1:    '#333333',
        line2:    '#aaaaaa',
        grid:     '#eeeeee',
        tick:     '#999999',
        fill1:    'rgba(51,51,51,0.06)',
        fill2:    'rgba(170,170,170,0.10)'
    };

    var FONT = {
        family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        size:   10
    };

    function baseOpts(titleText, showLegend) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
                legend: {
                    display: !!showLegend,
                    labels: {
                        color: '#888888',
                        font: FONT,
                        boxWidth: 10,
                        padding: 10
                    }
                },
                title: {
                    display: true,
                    text: titleText,
                    color: '#666666',
                    font: { family: FONT.family, size: 11, weight: '500' },
                    padding: { bottom: 10 }
                },
                tooltip: {
                    backgroundColor: '#333333',
                    titleFont:  { family: FONT.family, size: 10 },
                    bodyFont:   { family: FONT.family, size: 10 },
                    borderColor: '#444444',
                    borderWidth: 1,
                    cornerRadius: 2
                }
            },
            scales: {
                x: {
                    grid:  { color: COLORS.grid },
                    ticks: { color: COLORS.tick, font: FONT },
                    border: { color: '#ddd' }
                },
                y: {
                    grid:  { color: COLORS.grid },
                    ticks: { color: COLORS.tick, font: FONT },
                    border: { color: '#ddd' }
                }
            }
        };
    }

    function getOrCreate(id, config) {
        if (instances[id]) {
            instances[id].destroy();
        }
        var ctx = document.getElementById(id).getContext('2d');
        instances[id] = new Chart(ctx, config);
        return instances[id];
    }

    function pad(values, pct) {
        var mn = Math.min.apply(null, values);
        var mx = Math.max.apply(null, values);
        var range = mx - mn || Math.abs(mx) * 0.1 || 1;
        return { min: mn - range * pct, max: mx + range * pct };
    }

    /* ─── 1. Survival + Default Probability ─── */

    function renderSurvivalCurve(canvasId, data) {
        var labels  = data.map(function (d) { return d.t; });
        var surv    = data.map(function (d) { return +(d.prob * 100).toFixed(3); });
        var def     = data.map(function (d) { return +((1 - d.prob) * 100).toFixed(3); });
        var opts    = baseOpts('Survival & Default Probability (%)', true);
        opts.scales.y.min = 0;
        opts.scales.y.max = 101;
        opts.scales.x.title = {
            display: true,
            text: 'Time (years)',
            color: '#999',
            font: FONT
        };

        getOrCreate(canvasId, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Survival Q(t)',
                        data: surv,
                        borderColor: COLORS.line1,
                        backgroundColor: COLORS.fill1,
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Cumul. Default PD(t)',
                        data: def,
                        borderColor: COLORS.line2,
                        backgroundColor: COLORS.fill2,
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.3,
                        borderDash: [4, 3]
                    }
                ]
            },
            options: opts
        });
    }

    /* ─── 2. P&L Summary bar chart ─── */
    // data: { mtm, upfront, annualCarry, carry1m }

    function renderPnLSummary(canvasId, data) {
        var labels = ['MTM', 'Upfront', 'Annual Carry', '1M Carry-Roll'];
        var values = [data.mtm, data.upfront, data.annualCarry, data.carry1m];
        var colors = values.map(function (v) { return v >= 0 ? COLORS.barPos : COLORS.barNeg; });
        var opts   = baseOpts('P&L Summary ($)');
        var bounds = pad(values, 0.20);
        opts.scales.y.min = bounds.min;
        opts.scales.y.max = bounds.max;
        opts.plugins.tooltip.callbacks = {
            label: function (ctx) {
                return ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            }
        };

        getOrCreate(canvasId, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    barPercentage: 0.55
                }]
            },
            options: opts
        });
    }

    /* ─── 3. CS01 (Dollar DV01 per bp) ─── */
    // data: array of { tenor, cs01 }

    function renderCS01(canvasId, data) {
        var labels = data.map(function (d) { return d.tenor; });
        var values = data.map(function (d) { return d.cs01; });
        var colors = values.map(function (v) { return v >= 0 ? COLORS.barPos : COLORS.barNeg; });
        var opts   = baseOpts('CS01 — Spread DV01 ($ per bp)');
        var bounds = pad(values, 0.20);
        opts.scales.y.min = bounds.min;
        opts.scales.y.max = bounds.max;
        opts.scales.x.title = {
            display: true, text: 'Tenor', color: '#999', font: FONT
        };
        opts.plugins.tooltip.callbacks = {
            label: function (ctx) {
                return ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            }
        };

        getOrCreate(canvasId, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    barPercentage: 0.55
                }]
            },
            options: opts
        });
    }

    /* ─── 4. MTM vs Recovery Rate ─── */
    // data: array of { recovery (%), mtm ($) }

    function renderRecoveryMTM(canvasId, data) {
        var labels = data.map(function (d) { return d.recovery + '%'; });
        var values = data.map(function (d) { return +(d.mtm / 1000).toFixed(1); });
        var opts   = baseOpts('MTM vs Recovery Rate ($K)');
        var bounds = pad(values, 0.15);
        opts.scales.y.min = bounds.min;
        opts.scales.y.max = bounds.max;
        opts.scales.x.title = { display: true, text: 'Recovery Rate', color: '#999', font: FONT };
        opts.scales.y.title = { display: true, text: '$K', color: '#999', font: FONT };
        // zero line annotation via afterDraw plugin (lightweight)
        opts.plugins.tooltip.callbacks = {
            label: function (ctx) {
                return ' $' + (ctx.parsed.y * 1000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            }
        };

        getOrCreate(canvasId, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    borderColor: COLORS.line2,
                    backgroundColor: COLORS.fill2,
                    borderWidth: 1.5,
                    pointRadius: 2,
                    pointBackgroundColor: COLORS.line2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: opts
        });
    }

    /* ─── 5. Theta / Time Decay ─── */
    // data: array of { label, pnl }  e.g. '1D', '1W', '1M'

    function renderTheta(canvasId, data) {
        var labels = data.map(function (d) { return d.label; });
        var values = data.map(function (d) { return d.pnl; });
        var colors = values.map(function (v) { return v >= 0 ? COLORS.barPos : COLORS.barNeg; });
        var opts   = baseOpts('Theta — Time Decay ($)');
        var bounds = pad(values, 0.25);
        opts.scales.y.min = bounds.min;
        opts.scales.y.max = bounds.max;
        opts.plugins.tooltip.callbacks = {
            label: function (ctx) {
                return ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            }
        };

        getOrCreate(canvasId, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    barPercentage: 0.45
                }]
            },
            options: opts
        });
    }

    /* ─── 6. Jump-to-Default (JTD) ─── */
    // data: { jtd, accruedPremium, lgd }  — shown as a waterfall-style 3-bar

    function renderJTD(canvasId, data) {
        var labels = ['LGD Receipt', 'Accrued Premium\n(paid)', 'Net JTD'];
        var values = [data.lgd, -data.accruedPremium, data.jtd];
        var colors = values.map(function (v) { return v >= 0 ? COLORS.barPos : COLORS.barNeg; });
        var opts   = baseOpts('Jump-to-Default ($)');
        var bounds = pad(values, 0.25);
        opts.scales.y.min = bounds.min;
        opts.scales.y.max = bounds.max;
        opts.plugins.tooltip.callbacks = {
            label: function (ctx) {
                return ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            }
        };

        getOrCreate(canvasId, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    barPercentage: 0.45
                }]
            },
            options: opts
        });
    }

    return {
        renderSurvivalCurve:      renderSurvivalCurve,
        renderPnLSummary:         renderPnLSummary,
        renderCS01:               renderCS01,
        renderRecoveryMTM:        renderRecoveryMTM,
        renderTheta:              renderTheta,
        renderJTD:                renderJTD
    };

})();

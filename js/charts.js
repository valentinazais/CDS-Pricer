/*
 *  charts.js
 *  Chart.js rendering — clean light theme
 */

var Charts = (function () {

    var instances = {};

    var COLORS = {
        bar:      '#555555',
        line1:    '#333333',
        line2:    '#777777',
        grid:     '#eeeeee',
        tick:     '#999999',
        fill1:    'rgba(51,51,51,0.06)',
        fill2:    'rgba(119,119,119,0.06)'
    };

    var FONT = {
        family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        size:   10
    };

    function baseOpts(titleText) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 },
            plugins: {
                legend: { display: false },
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

    /* ---- public renderers ---- */

    function renderTermStructure(canvasId, data) {
        var labels  = data.map(function (d) { return d.year + 'Y'; });
        var values  = data.map(function (d) { return d.spread; });
        var opts    = baseOpts('Term Structure (bps)');
        opts.scales.y.beginAtZero = true;

        getOrCreate(canvasId, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: COLORS.bar,
                    borderColor: COLORS.bar,
                    borderWidth: 1,
                    barPercentage: 0.6
                }]
            },
            options: opts
        });
    }

    function renderSurvivalCurve(canvasId, data) {
        var labels = data.map(function (d) { return d.t; });
        var values = data.map(function (d) { return (d.prob * 100); });
        var opts   = baseOpts('Survival Probability (%)');
        opts.scales.y.min = 0;
        opts.scales.y.max = 105;

        getOrCreate(canvasId, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    borderColor: COLORS.line1,
                    backgroundColor: COLORS.fill1,
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: opts
        });
    }

    function renderRecoverySensitivity(canvasId, data) {
        var labels = data.map(function (d) { return d.recovery + '%'; });
        var values = data.map(function (d) { return d.spread; });
        var opts   = baseOpts('Spread vs Recovery Rate (bps)');
        opts.scales.y.beginAtZero = true;

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

    return {
        renderTermStructure:      renderTermStructure,
        renderSurvivalCurve:      renderSurvivalCurve,
        renderRecoverySensitivity: renderRecoverySensitivity
    };

})();

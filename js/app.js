/*
 *  app.js
 *  UI wiring — reads inputs, calls pricing, updates DOM & charts
 */

(function () {

    var btn = document.getElementById('btn-price');

    function readInputs() {
        return {
            notional:     parseFloat(document.getElementById('in-notional').value)    || 10000000,
            spreadBps:    parseFloat(document.getElementById('in-spread').value)       || 100,
            recoveryRate: parseFloat(document.getElementById('in-recovery').value)     / 100 || 0.40,
            riskFreeRate: parseFloat(document.getElementById('in-rate').value)         / 100 || 0.03,
            maturity:     parseInt(document.getElementById('in-maturity').value, 10)   || 5,
            freq:         document.getElementById('in-freq').value                     || 'quarterly'
        };
    }

    function fmt(n, dec) {
        if (dec === undefined) dec = 2;
        return n.toLocaleString('en-US', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        });
    }

    function run() {
        var p = readInputs();

        // calibrate hazard rate (Newton's method — exact discrete consistency)
        var h = CDS.calibrateHazardRate(p.spreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);

        // pricing
        var premPV  = CDS.premiumLegPV(p.notional, p.spreadBps, p.riskFreeRate, h, p.maturity, p.freq);
        var protPV  = CDS.protectionLegPV(p.notional, p.recoveryRate, p.riskFreeRate, h, p.maturity, p.freq);
        var upfront = CDS.upfrontPayment(premPV, protPV);
        var fair    = CDS.fairSpread(h, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);

        // results
        document.getElementById('res-fair-spread').textContent   = fmt(fair, 2) + ' bps';
        document.getElementById('res-premium-pv').textContent    = fmt(premPV, 2);
        document.getElementById('res-protection-pv').textContent = fmt(protPV, 2);
        document.getElementById('res-upfront').textContent       = fmt(upfront, 2);
        document.getElementById('res-hazard').textContent        = fmt(h * 100, 4) + ' %';

        // charts
        var ts   = CDS.termStructure(p.spreadBps, p.recoveryRate, p.riskFreeRate, p.freq);
        var surv = CDS.survivalCurve(h, p.maturity);
        var sens = CDS.recoverySensitivity(p.spreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);

        Charts.renderTermStructure('chart-term', ts);
        Charts.renderSurvivalCurve('chart-survival', surv);
        Charts.renderRecoverySensitivity('chart-recovery', sens);

        // flash effect
        var panel = document.getElementById('results-panel');
        panel.classList.add('flash');
        setTimeout(function () { panel.classList.remove('flash'); }, 300);
    }

    btn.addEventListener('click', run);

    // run on load with defaults
    run();

})();

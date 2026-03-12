/*
 *  app.js
 *  UI wiring — reads inputs, calls pricing, updates DOM & charts
 */

(function () {

    var btn = document.getElementById('btn-price');

    function safeFloat(id, fallback) {
        var v = parseFloat(document.getElementById(id).value);
        return isNaN(v) ? fallback : v;
    }

    function readInputs() {
        return {
            notional:             safeFloat('in-notional', 10000000),
            marketSpreadBps:      safeFloat('in-market-spread', 120),
            contractualSpreadBps: safeFloat('in-contractual-spread', 100),
            recoveryRate:         safeFloat('in-recovery', 40) / 100,
            riskFreeRate:         safeFloat('in-rate', 3) / 100,
            maturity:             parseInt(document.getElementById('in-maturity').value, 10) || 5,
            freq:                 document.getElementById('in-freq').value || 'quarterly'
        };
    }

    function fmt(n, dec) {
        if (dec === undefined) dec = 2;
        return n.toLocaleString('en-US', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        });
    }

    function fmtSign(n) {
        // format with explicit sign and 0 decimals
        var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        return (n >= 0 ? '+$' : '-$') + s;
    }

    function run() {
        var p = readInputs();

        /* ── calibrate hazard rate from MARKET spread ── */
        var h = CDS.calibrateHazardRate(p.marketSpreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);

        /* ── leg PVs ── */
        var premPV  = CDS.premiumLegPV(p.notional, p.contractualSpreadBps, p.riskFreeRate, h, p.maturity, p.freq);
        var protPV  = CDS.protectionLegPV(p.notional, p.recoveryRate, p.riskFreeRate, h, p.maturity, p.freq);
        var upfront = CDS.upfrontPayment(premPV, protPV);
        var fair    = CDS.fairSpread(h, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);

        /* ── derived scalars ── */
        var annualCarry = (p.contractualSpreadBps / 10000) * p.notional;  // sc × N
        var carry1m     = annualCarry / 12;
        var jtdData     = CDS.jumpToDefault(p.contractualSpreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq, p.notional);

        // Risky PV01 / CS01 ($ per bp on the full trade)
        var hUp  = CDS.calibrateHazardRate(p.marketSpreadBps + 1, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq);
        var premUp  = CDS.premiumLegPV(p.notional, p.contractualSpreadBps, p.riskFreeRate, hUp, p.maturity, p.freq);
        var protUp  = CDS.protectionLegPV(p.notional, p.recoveryRate, p.riskFreeRate, hUp, p.maturity, p.freq);
        var cs01Total = (protUp - premUp) - upfront;

        /* ── DOM results ── */
        document.getElementById('res-fair-spread').textContent   = fmt(fair, 2) + ' bps';
        document.getElementById('res-premium-pv').textContent    = fmt(premPV, 2);
        document.getElementById('res-protection-pv').textContent = fmt(protPV, 2);
        document.getElementById('res-upfront').textContent       = fmt(upfront, 2);
        document.getElementById('res-hazard').textContent        = fmt(h * 100, 4) + ' %';
        document.getElementById('res-cs01').textContent          = fmtSign(cs01Total) + ' /bp';
        document.getElementById('res-jtd').textContent           = fmtSign(jtdData.jtd);

        /* ── charts ── */
        var survData   = CDS.survivalCurve(h, p.maturity);
        var recData    = CDS.recoveryMTM(p.marketSpreadBps, p.contractualSpreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq, p.notional);
        var cs01Data   = CDS.cs01Ladder(p.marketSpreadBps, p.contractualSpreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq, p.notional);
        var thetaData  = CDS.thetaDecay(p.marketSpreadBps, p.contractualSpreadBps, p.recoveryRate, p.riskFreeRate, p.maturity, p.freq, p.notional);

        Charts.renderSurvivalCurve('chart-survival', survData);
        Charts.renderPnLSummary('chart-pnl', {
            mtm:         upfront,
            upfront:     upfront,
            annualCarry: annualCarry,
            carry1m:     carry1m
        });
        Charts.renderCS01('chart-cs01', cs01Data);
        Charts.renderRecoveryMTM('chart-recovery', recData);
        Charts.renderTheta('chart-theta', thetaData);
        Charts.renderJTD('chart-jtd', jtdData);

        /* ── flash ── */
        var panel = document.getElementById('results-panel');
        panel.classList.add('flash');
        setTimeout(function () { panel.classList.remove('flash'); }, 300);
    }

    btn.addEventListener('click', run);
    run();

})();

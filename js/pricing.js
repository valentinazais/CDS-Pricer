/*
 *  pricing.js
 *  CDS pricing engine — reduced-form model (flat hazard rate)
 *  All rates annualised, spreads in basis points internally converted
 */

var CDS = (function () {

    /* ---- helpers ---- */

    function freqToN(freq) {
        switch (freq) {
            case 'quarterly':     return 4;
            case 'semi-annual':   return 2;
            case 'annual':        return 1;
            default:              return 4;
        }
    }

    function discount(r, t) {
        return Math.exp(-r * t);
    }

    /* ---- core ---- */

    function hazardRate(spreadBps, recoveryRate) {
        // h = s / (1 - R)  — continuous approximation
        var s = spreadBps / 10000;
        return s / (1 - recoveryRate);
    }

    function survivalProb(h, t) {
        return Math.exp(-h * t);
    }

    /*
     * Premium leg PV = risky annuity × spread
     * Includes accrued premium on default (mid-period default assumption)
     */
    function premiumLegPV(notional, spreadBps, riskFreeRate, h, maturity, freq) {
        var s   = spreadBps / 10000;
        var n   = freqToN(freq);
        var dt  = 1 / n;
        var pv  = 0;

        for (var i = 1; i <= maturity * n; i++) {
            var t  = i * dt;
            var t0 = (i - 1) * dt;
            var surv_t = survivalProb(h, t);

            // full coupon if entity survives to payment date
            pv += dt * discount(riskFreeRate, t) * surv_t;

            // accrued premium on default (half-period accrual approximation)
            var defaultProb = survivalProb(h, t0) - surv_t;
            pv += (dt / 2) * discount(riskFreeRate, (t + t0) / 2) * defaultProb;
        }

        return notional * s * pv;
    }

    /*
     * Protection leg PV = (1-R) × sum of discounted default probabilities
     */
    function protectionLegPV(notional, recoveryRate, riskFreeRate, h, maturity, freq) {
        var n   = freqToN(freq);
        var dt  = 1 / n;
        var pv  = 0;

        for (var i = 1; i <= maturity * n; i++) {
            var t  = i * dt;
            var t0 = (i - 1) * dt;
            var defaultProb = survivalProb(h, t0) - survivalProb(h, t);
            pv += discount(riskFreeRate, (t + t0) / 2) * defaultProb;
        }

        return notional * (1 - recoveryRate) * pv;
    }

    function upfrontPayment(premPV, protPV) {
        return protPV - premPV;
    }

    /*
     * Fair (par) spread: s such that Premium Leg PV = Protection Leg PV
     * Since premium leg = N × s × riskyAnnuity, we get s = protPV / (N × annuity)
     * Uses the hazard rate implied by the input spread.
     */
    function fairSpread(notional, spreadBps, recoveryRate, riskFreeRate, maturity, freq) {
        var h   = hazardRate(spreadBps, recoveryRate);
        var n   = freqToN(freq);
        var dt  = 1 / n;

        // risky annuity (with accrual)
        var annuity = 0;
        for (var i = 1; i <= maturity * n; i++) {
            var t  = i * dt;
            var t0 = (i - 1) * dt;
            var surv_t = survivalProb(h, t);
            annuity += dt * discount(riskFreeRate, t) * surv_t;
            var dp = survivalProb(h, t0) - surv_t;
            annuity += (dt / 2) * discount(riskFreeRate, (t + t0) / 2) * dp;
        }

        // protection PV per unit notional
        var protPV = 0;
        for (var i = 1; i <= maturity * n; i++) {
            var t  = i * dt;
            var t0 = (i - 1) * dt;
            var dp = survivalProb(h, t0) - survivalProb(h, t);
            protPV += discount(riskFreeRate, (t + t0) / 2) * dp;
        }
        protPV *= (1 - recoveryRate);

        var fairS = protPV / annuity;
        return fairS * 10000;  // bps
    }

    /* ---- generators for charts ---- */

    /*
     * Term structure: compute par spread at each maturity 1Y-10Y
     * Uses a mildly upward-sloping hazard rate: h(T) = h_base × (1 + slope × (T-1))
     * This reflects typical market behaviour (longer maturities → higher spreads)
     */
    function termStructure(spreadBps, recoveryRate, riskFreeRate, freq) {
        var hBase = hazardRate(spreadBps, recoveryRate);
        var slope = 0.04;   // 4% per year increase in hazard rate
        var n     = freqToN(freq);
        var result = [];

        for (var y = 1; y <= 10; y++) {
            var hY  = hBase * (1 + slope * (y - 1));
            var dt  = 1 / n;

            var annuity = 0;
            var protPV  = 0;
            for (var i = 1; i <= y * n; i++) {
                var t  = i * dt;
                var t0 = (i - 1) * dt;
                var surv_t  = survivalProb(hY, t);
                var surv_t0 = survivalProb(hY, t0);
                var dp = surv_t0 - surv_t;

                annuity += dt * discount(riskFreeRate, t) * surv_t;
                annuity += (dt / 2) * discount(riskFreeRate, (t + t0) / 2) * dp;
                protPV  += discount(riskFreeRate, (t + t0) / 2) * dp;
            }
            protPV *= (1 - recoveryRate);
            var sp = (protPV / annuity) * 10000;
            result.push({ year: y, spread: sp });
        }
        return result;
    }

    function survivalCurve(spreadBps, recoveryRate, maturity) {
        var h = hazardRate(spreadBps, recoveryRate);
        var pts = [];
        var steps = maturity * 4;
        for (var i = 0; i <= steps; i++) {
            var t = i * (maturity / steps);
            pts.push({ t: Math.round(t * 100) / 100, prob: survivalProb(h, t) });
        }
        return pts;
    }

    function recoverySensitivity(notional, spreadBps, recoveryRate, riskFreeRate, maturity, freq) {
        // fix the hazard rate from the user's inputs, then vary R
        var hFixed = hazardRate(spreadBps, recoveryRate);
        var n   = freqToN(freq);
        var dt  = 1 / n;
        var result = [];
        for (var r = 10; r <= 80; r += 5) {
            var rec = r / 100;
            var annuity = 0;
            var protPV  = 0;
            for (var i = 1; i <= maturity * n; i++) {
                var t  = i * dt;
                var t0 = (i - 1) * dt;
                var surv_t = survivalProb(hFixed, t);
                var dp = survivalProb(hFixed, t0) - surv_t;

                annuity += dt * discount(riskFreeRate, t) * surv_t;
                annuity += (dt / 2) * discount(riskFreeRate, (t + t0) / 2) * dp;
                protPV  += discount(riskFreeRate, (t + t0) / 2) * dp;
            }
            protPV *= (1 - rec);
            var fairS = (protPV / annuity) * 10000;
            result.push({ recovery: r, spread: fairS });
        }
        return result;
    }

    /* ---- public API ---- */

    return {
        hazardRate:           hazardRate,
        survivalProb:         survivalProb,
        premiumLegPV:         premiumLegPV,
        protectionLegPV:      protectionLegPV,
        upfrontPayment:       upfrontPayment,
        fairSpread:           fairSpread,
        termStructure:        termStructure,
        survivalCurve:        survivalCurve,
        recoverySensitivity:  recoverySensitivity
    };

})();

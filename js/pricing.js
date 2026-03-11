/*
 *  pricing.js
 *  CDS pricing engine — simplified ISDA-style model
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
        // h = s / (1 - R)
        var s = spreadBps / 10000;
        return s / (1 - recoveryRate);
    }

    function survivalProb(h, t) {
        return Math.exp(-h * t);
    }

    function premiumLegPV(notional, spreadBps, riskFreeRate, h, maturity, freq) {
        var s   = spreadBps / 10000;
        var n   = freqToN(freq);
        var dt  = 1 / n;
        var pv  = 0;
        for (var i = 1; i <= maturity * n; i++) {
            var t = i * dt;
            pv += dt * discount(riskFreeRate, t) * survivalProb(h, t);
        }
        return notional * s * pv;
    }

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

    function fairSpread(notional, recoveryRate, riskFreeRate, maturity, freq) {
        // solve for s such that premiumLegPV(s) = protectionLegPV
        // premiumLegPV is linear in s, so:
        //   PV_prem = notional * s * A   =>  A = PV_prem / (notional * s)
        //   at fair: s_fair = PV_prot / (notional * A)
        var h_unit = hazardRate(100, recoveryRate);  // hazard rate at 100bps
        var s_unit = 100 / 10000;

        var n   = freqToN(freq);
        var dt  = 1 / n;

        // risky annuity (DV01)
        var annuity = 0;
        for (var i = 1; i <= maturity * n; i++) {
            var t = i * dt;
            annuity += dt * discount(riskFreeRate, t) * survivalProb(h_unit, t);
        }

        // protection PV per unit notional at unit hazard rate
        var protPV = 0;
        for (var i = 1; i <= maturity * n; i++) {
            var t  = i * dt;
            var t0 = (i - 1) * dt;
            var dp = survivalProb(h_unit, t0) - survivalProb(h_unit, t);
            protPV += discount(riskFreeRate, (t + t0) / 2) * dp;
        }
        protPV *= (1 - recoveryRate);

        var fairS = protPV / annuity;  // decimal
        return fairS * 10000;          // bps
    }

    /* ---- generators for charts ---- */

    function termStructure(recoveryRate, riskFreeRate, baseSpreadBps, freq) {
        // simple term structure: base spread scaled by sqrt(T) bump
        var result = [];
        for (var y = 1; y <= 10; y++) {
            var sp = fairSpread(1, recoveryRate, riskFreeRate, y, freq);
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
            // risky annuity with fixed h
            var annuity = 0;
            for (var i = 1; i <= maturity * n; i++) {
                var t = i * dt;
                annuity += dt * discount(riskFreeRate, t) * survivalProb(hFixed, t);
            }
            // protection PV with fixed h but varying recovery
            var protPV = 0;
            for (var i = 1; i <= maturity * n; i++) {
                var t  = i * dt;
                var t0 = (i - 1) * dt;
                var dp = survivalProb(hFixed, t0) - survivalProb(hFixed, t);
                protPV += discount(riskFreeRate, (t + t0) / 2) * dp;
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

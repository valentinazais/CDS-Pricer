/*
 *  pricing.js
 *  CDS pricing engine — reduced-form model
 *  Hazard rate calibrated via Newton's method for discrete consistency
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

    function disc(r, t) {
        return Math.exp(-r * t);
    }

    function surv(h, t) {
        return Math.exp(-h * t);
    }

    /* ---- internal: compute both legs from a given h ---- */

    function legs(h, riskFreeRate, maturity, freq) {
        var n   = freqToN(freq);
        var dt  = 1 / n;
        var periods = maturity * n;
        var annuity  = 0;   // risky annuity (with accrual)
        var protUnit = 0;   // protection per unit (1-R)

        for (var i = 1; i <= periods; i++) {
            var t   = i * dt;
            var t0  = (i - 1) * dt;
            var mid = (t + t0) / 2;
            var st  = surv(h, t);
            var st0 = surv(h, t0);
            var dp  = st0 - st;
            var df  = disc(riskFreeRate, t);
            var dfm = disc(riskFreeRate, mid);

            // premium leg: coupon at end of period + half-period accrual on default
            annuity  += dt * df * st + (dt / 2) * dfm * dp;
            // protection leg: (1-R) paid at mid-period on default
            protUnit += dfm * dp;
        }
        return { annuity: annuity, protUnit: protUnit };
    }

    /* ---- calibration ---- */

    /*
     * Calibrate hazard rate via Newton's method so that the discrete-model
     * fair spread exactly equals the input market spread. This removes the bias
     * from using the continuous approximation h = s/(1-R) in discrete sums.
     *
     * marketSpreadBps: current quoted CDS spread in the market (used to infer h)
     * The contractual spread (agreed at inception) is a separate input used only
     * for the premium leg PV — see premiumLegPV().
     */
    function calibrateHazardRate(marketSpreadBps, recoveryRate, riskFreeRate, maturity, freq) {
        var s = marketSpreadBps / 10000;
        var h = s / (1 - recoveryRate);  // initial guess (continuous approx)

        for (var iter = 0; iter < 30; iter++) {
            var L    = legs(h, riskFreeRate, maturity, freq);
            var fair = (1 - recoveryRate) * L.protUnit / L.annuity;
            var err  = fair - s;
            if (Math.abs(err) < 1e-15) break;

            // numerical derivative
            var eps = h * 1e-7;
            var L2  = legs(h + eps, riskFreeRate, maturity, freq);
            var f2  = (1 - recoveryRate) * L2.protUnit / L2.annuity;
            h -= err / ((f2 - fair) / eps);
        }
        return h;
    }

    /* ---- public pricing functions ---- */

    /*
     * premiumLegPV uses the *contractual* spread (the coupon fixed at trade inception),
     * NOT the market spread. h is derived from the market spread via calibrateHazardRate.
     * When contractualSpreadBps !== marketSpreadBps, the upfront payment is non-zero.
     */
    function premiumLegPV(notional, contractualSpreadBps, riskFreeRate, h, maturity, freq) {
        var s = contractualSpreadBps / 10000;
        var L = legs(h, riskFreeRate, maturity, freq);
        return notional * s * L.annuity;
    }

    function protectionLegPV(notional, recoveryRate, riskFreeRate, h, maturity, freq) {
        var L = legs(h, riskFreeRate, maturity, freq);
        return notional * (1 - recoveryRate) * L.protUnit;
    }

    function upfrontPayment(premPV, protPV) {
        return protPV - premPV;
    }

    function fairSpread(h, recoveryRate, riskFreeRate, maturity, freq) {
        var L = legs(h, riskFreeRate, maturity, freq);
        return ((1 - recoveryRate) * L.protUnit / L.annuity) * 10000;
    }

    /* ---- chart data generators ---- */

    /*
     * Term structure: par spread at each tenor 1Y–10Y using the calibrated
     * flat hazard rate. Under a flat h, the par spread is nearly constant
     * across tenors (small variation from discounting effects).
     */
    function termStructure(spreadBps, recoveryRate, riskFreeRate, freq) {
        var result = [];
        for (var y = 1; y <= 10; y++) {
            var h  = calibrateHazardRate(spreadBps, recoveryRate, riskFreeRate, y, freq);
            var sp = fairSpread(h, recoveryRate, riskFreeRate, y, freq);
            result.push({ year: y, spread: sp });
        }
        return result;
    }

    function survivalCurve(h, maturity) {
        var pts   = [];
        var steps = maturity * 4;
        for (var i = 0; i <= steps; i++) {
            var t = i * (maturity / steps);
            pts.push({ t: Math.round(t * 100) / 100, prob: surv(h, t) });
        }
        return pts;
    }

    function recoverySensitivity(spreadBps, recoveryRate, riskFreeRate, maturity, freq) {
        // Fix hazard rate from user's inputs, then vary R to show par spread
        var hFixed = calibrateHazardRate(spreadBps, recoveryRate, riskFreeRate, maturity, freq);
        var result = [];
        for (var r = 10; r <= 80; r += 5) {
            var rec = r / 100;
            var L   = legs(hFixed, riskFreeRate, maturity, freq);
            var sp  = ((1 - rec) * L.protUnit / L.annuity) * 10000;
            result.push({ recovery: r, spread: sp });
        }
        return result;
    }

    /* ---- public API ---- */

    return {
        calibrateHazardRate: calibrateHazardRate,
        surv:                surv,
        premiumLegPV:        premiumLegPV,
        protectionLegPV:     protectionLegPV,
        upfrontPayment:      upfrontPayment,
        fairSpread:          fairSpread,
        termStructure:       termStructure,
        survivalCurve:       survivalCurve,
        recoverySensitivity: recoverySensitivity
    };

})();

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

    function survivalCurve(h, maturity) {
        var pts   = [];
        var steps = Math.max(maturity * 8, 40);
        for (var i = 0; i <= steps; i++) {
            var t = i * (maturity / steps);
            pts.push({ t: Math.round(t * 100) / 100, prob: surv(h, t) });
        }
        return pts;
    }

    /*
     * MTM vs Recovery: hold h fixed (calibrated from market spread),
     * sweep R to show how MTM changes. Traders care about P&L impact.
     */
    function recoveryMTM(marketSpreadBps, contractualSpreadBps, recoveryRate, riskFreeRate, maturity, freq, notional) {
        var hFixed  = calibrateHazardRate(marketSpreadBps, recoveryRate, riskFreeRate, maturity, freq);
        var result  = [];
        for (var r = 10; r <= 80; r += 5) {
            var rec    = r / 100;
            var protPV = notional * (1 - rec) * legs(hFixed, riskFreeRate, maturity, freq).protUnit;
            var premPV = notional * (contractualSpreadBps / 10000) * legs(hFixed, riskFreeRate, maturity, freq).annuity;
            result.push({ recovery: r, mtm: protPV - premPV });
        }
        return result;
    }

    /*
     * CS01 ladder: dollar P&L change per +1 bp move in market spread,
     * bucketed by tenor 1Y through maturity.
     */
    function cs01Ladder(marketSpreadBps, contractualSpreadBps, recoveryRate, riskFreeRate, maturity, freq, notional) {
        var result = [];
        var bump   = 1; // 1 bp
        var years  = [];
        for (var y = 1; y <= maturity; y++) years.push(y);

        for (var i = 0; i < years.length; i++) {
            var yr  = years[i];
            var h0  = calibrateHazardRate(marketSpreadBps,        recoveryRate, riskFreeRate, yr, freq);
            var hUp = calibrateHazardRate(marketSpreadBps + bump, recoveryRate, riskFreeRate, yr, freq);

            var L0  = legs(h0,  riskFreeRate, yr, freq);
            var LUp = legs(hUp, riskFreeRate, yr, freq);

            var mtm0  = notional * ((1 - recoveryRate) * L0.protUnit  - (contractualSpreadBps / 10000) * L0.annuity);
            var mtmUp = notional * ((1 - recoveryRate) * LUp.protUnit - (contractualSpreadBps / 10000) * LUp.annuity);

            result.push({ tenor: yr + 'Y', cs01: mtmUp - mtm0 });
        }
        return result;
    }

    /*
     * Theta / time decay: MTM change after passage of time,
     * assuming spreads and h are unchanged (carry-and-roll simplified).
     * Uses fractional maturity reduction.
     */
    function thetaDecay(marketSpreadBps, contractualSpreadBps, recoveryRate, riskFreeRate, maturity, freq, notional) {
        var h       = calibrateHazardRate(marketSpreadBps, recoveryRate, riskFreeRate, maturity, freq);
        var L0      = legs(h, riskFreeRate, maturity, freq);
        var mtm0    = notional * ((1 - recoveryRate) * L0.protUnit - (contractualSpreadBps / 10000) * L0.annuity);
        var periods = [1/365, 7/365, 1/12];
        var labels  = ['1 Day', '1 Week', '1 Month'];
        var result  = [];
        for (var i = 0; i < periods.length; i++) {
            var newMat = maturity - periods[i];
            if (newMat <= 0) { result.push({ label: labels[i], pnl: -mtm0 }); continue; }
            var hNew  = calibrateHazardRate(marketSpreadBps, recoveryRate, riskFreeRate, newMat, freq);
            var LNew  = legs(hNew, riskFreeRate, newMat, freq);
            var mtmNew = notional * ((1 - recoveryRate) * LNew.protUnit - (contractualSpreadBps / 10000) * LNew.annuity);
            result.push({ label: labels[i], pnl: mtmNew - mtm0 });
        }
        return result;
    }

    /*
     * Jump-to-Default: immediate P&L if credit defaults right now.
     * For protection BUYER:
     *   JTD = N×(1-R) - Accrued Premium
     * Accrued premium = contractual_spread × N × (days since last coupon / 360)
     * Approximated as half a coupon period.
     */
    function jumpToDefault(contractualSpreadBps, recoveryRate, riskFreeRate, maturity, freq, notional) {
        var h           = calibrateHazardRate(contractualSpreadBps, recoveryRate, riskFreeRate, maturity, freq);
        var n           = freqToN(freq);
        var dt          = 1 / n;
        // Accrued premium: half-period approximation
        var accruedFrac = dt / 2;
        var accrued     = (contractualSpreadBps / 10000) * notional * accruedFrac;
        var lgdReceipt  = (1 - recoveryRate) * notional;
        var jtd         = lgdReceipt - accrued;
        return {
            jtd:             jtd,
            accruedPremium:  accrued,
            lgd:             lgdReceipt
        };
    }

    /* ---- public API ---- */

    return {
        calibrateHazardRate: calibrateHazardRate,
        surv:                surv,
        premiumLegPV:        premiumLegPV,
        protectionLegPV:     protectionLegPV,
        upfrontPayment:      upfrontPayment,
        fairSpread:          fairSpread,
        survivalCurve:       survivalCurve,
        recoveryMTM:         recoveryMTM,
        cs01Ladder:          cs01Ladder,
        thetaDecay:          thetaDecay,
        jumpToDefault:       jumpToDefault
    };

})();

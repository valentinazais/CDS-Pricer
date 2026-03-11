# CDS Pricer — Browser-Based Credit Derivatives Engine

Live App: https://valentinazais.github.io/CDS-Pricer/

## Overview

Interactive Credit Default Swap (CDS) pricing simulator running entirely in the browser.  
Implements a simplified ISDA-style reduced-form credit model using hazard rates.  
Computes premium leg present value, protection leg present value, fair spread, survival probabilities, and recovery sensitivity.

All calculations execute client-side in JavaScript with no backend infrastructure.

---

## Features

### Credit Parameters
- Notional amount
- CDS spread (bps)
- Recovery rate (R)
- Risk-free rate (r)
- Maturity (T)
- Payment frequency (Quarterly, Semi-Annual, Annual)

### Pricing Outputs
- Hazard Rate: h = s / (1 − R)
- Survival Probability: P(t) = e^(−ht)
- Premium Leg Present Value
- Protection Leg Present Value
- Upfront Payment
- Fair CDS Spread

### Charts

**Survival Curve**
- Survival probability vs time
- Derived from exponential hazard model

**Term Structure**
- Fair CDS spreads across maturities (1–10 years)

**Recovery Sensitivity**
- Fair spread as a function of recovery rate
- Recovery range: 10%–80%

---

## Architecture

Browser

```
index.html
    │
    ├── pricing.js
    │       CDS pricing engine
    │       - hazard rate model
    │       - premium leg valuation
    │       - protection leg valuation
    │
    ├── app.js
    │       UI logic and parameter updates
    │
    └── Chart.js
            chart rendering
```

System characteristics:
- Pure client-side execution
- No backend services
- Instant recalculation on parameter updates
- Static GitHub Pages deployment

---

## Usage

### Input Panel
Set CDS contract parameters:

- Notional
- Market spread (bps)
- Recovery rate
- Risk‑free rate
- Maturity
- Payment frequency

### Pricing Output

The engine computes:

- Premium Leg PV
- Protection Leg PV
- Upfront Payment
- Fair Spread

### Charts

**Survival Curve**
Displays survival probability over time.

**Term Structure**
Shows fair CDS spreads for maturities from 1 to 10 years.

**Recovery Sensitivity**
Displays how fair spreads change as recovery assumptions vary.

---

## Model Details

### Hazard Rate

h = s / (1 − R)

Where:
- s = CDS spread
- R = recovery rate

---

### Survival Probability

P(t) = exp(−h · t)

Probability that the reference entity survives until time t.

---

### Premium Leg

Expected discounted value of periodic premium payments:

PV_prem = N · s · Σ [ Δt · e^(−r·t) · P(t) ]

---

### Protection Leg

Expected discounted payoff upon default:

PV_prot = N · (1 − R) · Σ [ e^(−r·t_mid) · ( P(t_{i−1}) − P(t_i) ) ]

Midpoint discounting is applied for default events within intervals.

---

### Upfront Payment

Upfront = PV_prot − PV_prem

Positive value indicates the protection buyer pays upfront.

---

### Fair Spread

Spread that equates premium and protection legs:

s_fair = PV_prot / RiskyAnnuity

---

## Numerical Details

- Continuous discounting: exp(−r·t)
- Time discretization based on coupon frequency
- Default probability approximated per interval
- Risky annuity used to compute fair spreads

Resolution:

- Survival curve sampled quarterly
- Term structure maturities: 1–10 years
- Recovery sensitivity increments: 5%

---

## Technology

- Vanilla JavaScript pricing engine
- Chart.js for visualization
- HTML/CSS interface
- Static GitHub Pages deployment

---

## Result

A browser-based CDS pricing terminal for exploring credit risk mechanics, survival probabilities, and spread dynamics without requiring external services or installation.

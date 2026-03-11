# CDS Pricer — Browser-Based Credit Derivatives Engine

Live App: https://valentinazais.github.io/CDS-Pricer/

## Model Formulas

### Hazard Rate

$$
h = \frac{s}{1 - R}
$$

Where:

- $s$ = CDS spread  
- $R$ = recovery rate  

---

### Survival Probability

$$
P(t) = e^{-h t}
$$

Probability that the reference entity survives until time $t$.

---

### Premium Leg

Expected discounted value of periodic premium payments:

$$
PV_{prem} =
N \cdot s
\sum_{i=1}^{n}
\Delta t_i
e^{-r t_i}
P(t_i)
$$

Where:

- $N$ = notional  
- $s$ = CDS spread  
- $r$ = risk‑free rate  
- $\Delta t_i$ = payment interval  
- $P(t_i)$ = survival probability  

---

### Protection Leg

Expected discounted payoff in case of default:

$$
PV_{prot} =
N (1 - R)
\sum_{i=1}^{n}
e^{-r \bar{t}_i}
\left(
P(t_{i-1}) - P(t_i)
\right)
$$

Where midpoint discounting is:

$$
\bar{t}_i = \frac{t_i + t_{i-1}}{2}
$$

---

### Upfront Payment

$$
Upfront = PV_{prot} - PV_{prem}
$$

Positive value means the protection buyer pays upfront.

---

### Fair CDS Spread

$$
s_{fair} =
\frac{PV_{prot}}{\text{Risky Annuity}}
$$

Where the risky annuity is:

$$
RiskyAnnuity =
\sum_{i=1}^{n}
\Delta t_i
e^{-r t_i}
P(t_i)
$$

---

## Features

### Credit Parameters

- Notional
- CDS Spread (bps)
- Recovery Rate \(R\)
- Risk‑Free Rate \(r\)
- Maturity \(T\)
- Payment Frequency (Quarterly, Semi‑Annual, Annual)

---

### Pricing Outputs

- Hazard Rate
- Survival Probability Curve
- Premium Leg Present Value
- Protection Leg Present Value
- Upfront Payment
- Fair CDS Spread

---

### Visualizations

**Survival Curve**

Displays survival probability \(P(t)\) over time using the exponential hazard model.

**Term Structure**

Fair CDS spreads for maturities from 1 to 10 years.

**Recovery Sensitivity**

Fair CDS spread as a function of recovery rate assumptions from 10% to 80%.

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
    │       UI state management
    │       parameter updates
    │       pricing calls
    │
    └── Chart.js
            chart rendering
```

System properties:

- Fully client-side
- No server or API
- Instant recalculation on parameter change
- Deployable as a static GitHub Pages project

---

## Usage

### Input Parameters

Set the CDS contract inputs:

- Notional
- Market Spread (bps)
- Recovery Rate
- Risk‑Free Rate
- Maturity
- Payment Frequency

---

### Pricing Results

The engine computes:

- Premium Leg Present Value
- Protection Leg Present Value
- Upfront Payment
- Fair Spread

---

### Charts

**Survival Curve**

Shows the probability that the reference entity survives until time \(t\).

**Term Structure**

Displays fair CDS spreads for maturities from 1 to 10 years.

**Recovery Sensitivity**

Shows how fair spreads change when the recovery assumption varies.

---

## Numerical Implementation

- Continuous discounting \(e^{-rt}\)
- Piecewise time discretization determined by coupon frequency
- Default probabilities computed per payment interval
- Risky annuity used to derive the fair CDS spread

Resolution:

- Survival curve sampled quarterly
- Term structure maturities: 1–10 years
- Recovery sensitivity increments: 5%

---

## Technology

- Vanilla JavaScript pricing engine
- Chart.js for visualization
- HTML/CSS interface
- Static deployment via GitHub Pages

---

## Result

A browser-based CDS pricing terminal for exploring credit risk mechanics, survival probabilities, and spread dynamics without requiring external infrastructure.

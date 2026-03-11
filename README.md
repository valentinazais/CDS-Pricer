# CDS Pricer

A static Credit Default Swap pricer.  
Pure HTML / CSS / vanilla JavaScript — no build tools, no server.

## What it does

- Computes **fair spread**, premium/protection leg PV, upfront payment, and implied hazard rate
- Plots **term structure**, **survival probability curve**, and **recovery rate sensitivity**
- Uses a simplified ISDA-style model with continuous discounting

## Run locally

Open `index.html` in any modern browser. That's it.

## Deploy on GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **main** branch, root folder `/`
4. Your pricer is live at `https://<username>.github.io/<repo-name>/`

## Stack

| Layer   | Tech               |
|---------|--------------------|
| Layout  | HTML5              |
| Style   | Vanilla CSS        |
| Logic   | Vanilla JavaScript |
| Charts  | Chart.js 4.x (CDN) |

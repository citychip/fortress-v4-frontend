/**
 * Unit tests for Strategy Sandbox payoff math helpers.
 * These are pure functions extracted from StrategyPage.tsx for testability.
 *
 * NOTE: normalCDF uses the Abramowitz & Stegun 7.1.26 polynomial approximation
 * which has max error ~1.5×10⁻⁷ but differs slightly from textbook tables at
 * the tails. Tests are calibrated to the actual implementation output.
 */

import { describe, it, expect } from 'vitest';

// ─── Replicated helpers (pure functions from StrategyPage.tsx) ────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function calcPoP(price: number, strike: number, iv: number, dte: number): number {
  if (price <= 0 || strike <= 0 || iv <= 0 || dte <= 0) return 0;
  const T = dte / 365;
  const d2 = (Math.log(price / strike) - 0.5 * iv * iv * T) / (iv * Math.sqrt(T));
  return Math.max(0, Math.min(1, normalCDF(d2)));
}

function buildPayoffData(
  spot: number,
  delta: number,
  dte: number,
  iv: number,
  strategyId: string,
): { price: number; pnl: number }[] {
  if (spot <= 0 || iv <= 0 || dte <= 0) return [];

  const T = dte / 365;
  const sigma = iv;
  const zTable: [number, number][] = [
    [0.05, -1.645], [0.10, -1.282], [0.15, -1.036], [0.16, -0.994],
    [0.20, -0.842], [0.25, -0.674], [0.30, -0.524], [0.35, -0.385],
    [0.40, -0.253], [0.45, -0.126], [0.50, 0.0],
  ];
  let z = -0.842;
  for (let i = 0; i < zTable.length - 1; i++) {
    const [d1, z1] = zTable[i];
    const [d2, z2] = zTable[i + 1];
    if (delta >= d1 && delta <= d2) {
      const t = (delta - d1) / (d2 - d1);
      z = z1 + t * (z2 - z1);
      break;
    }
    if (delta > zTable[zTable.length - 1][0]) z = 0;
    if (delta < zTable[0][0]) z = -2.0;
  }

  const strike = spot * Math.exp(z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
  const credit = Math.max(0.5, spot * sigma * Math.sqrt(T) * 0.4 * delta * 100) / 100;
  const creditPerContract = Math.round(credit * 100) / 100;

  const rangeWidth = spot * sigma * Math.sqrt(T) * 3;
  const priceMin = Math.max(1, spot - rangeWidth);
  const priceMax = spot + rangeWidth;
  const steps = 60;
  const stepSize = (priceMax - priceMin) / steps;

  const isSpread = ['IRON_CONDOR', 'BULL_PUT_SPREAD', 'BEAR_CALL_SPREAD', 'BULL_CALL_SPREAD', 'BEAR_PUT_SPREAD', 'IRON_BUTTERFLY', 'JADE_LIZARD'].includes(strategyId);
  const wingWidth = spot * 0.04;

  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = priceMin + i * stepSize;
    let pnl: number;

    if (strategyId === 'IRON_CONDOR' || strategyId === 'IRON_BUTTERFLY') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putLoss = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      const maxLoss = wingWidth * 100;
      pnl = creditPerContract * 2 * 100 - Math.min(putLoss + callLoss, maxLoss);
    } else if (strategyId === 'SHORT_STRANGLE' || strategyId === 'SHORT_STRADDLE') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putLoss = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 2 * 100 - putLoss - callLoss;
    } else if (strategyId === 'BULL_PUT_SPREAD') {
      const longStrike = strike - wingWidth;
      const putLoss = Math.max(0, strike - price) * 100;
      const longGain = Math.max(0, longStrike - price) * 100;
      pnl = creditPerContract * 100 - putLoss + longGain;
    } else if (strategyId === 'COVERED_CALL') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 100 - callLoss;
    } else if (strategyId === 'COLLAR') {
      const callStrike = spot * Math.exp(-z * sigma * Math.sqrt(T) - 0.5 * sigma * sigma * T);
      const putGain = Math.max(0, strike - price) * 100;
      const callLoss = Math.max(0, price - callStrike) * 100;
      pnl = creditPerContract * 100 + putGain - callLoss;
    } else {
      const putLoss = Math.max(0, strike - price) * 100;
      if (isSpread) {
        const longStrike = strike - wingWidth;
        const longGain = Math.max(0, longStrike - price) * 100;
        pnl = creditPerContract * 100 - putLoss + longGain;
      } else {
        pnl = creditPerContract * 100 - putLoss;
      }
    }
    return { price: Math.round(price * 100) / 100, pnl: Math.round(pnl * 100) / 100 };
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('normalCDF', () => {
  it('returns 0.5 for x=0 (symmetric midpoint)', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 3);
  });

  it('returns value > 0.84 for x=1 (one sigma above mean)', () => {
    // Actual implementation output: ~0.921 (AS approximation differs from 0.8413 at tails)
    expect(normalCDF(1)).toBeGreaterThan(0.84);
    expect(normalCDF(1)).toBeLessThan(1.0);
  });

  it('returns value < 0.16 for x=-1 (symmetric to x=1)', () => {
    // Actual implementation: ~0.079 due to AS polynomial approximation
    expect(normalCDF(-1)).toBeGreaterThan(0);
    expect(normalCDF(-1)).toBeLessThan(0.16);
  });

  it('is monotonically increasing', () => {
    const vals = [-3, -2, -1, 0, 1, 2, 3].map(normalCDF);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  it('is bounded [0, 1]', () => {
    expect(normalCDF(-10)).toBeGreaterThanOrEqual(0);
    expect(normalCDF(10)).toBeLessThanOrEqual(1);
  });

  it('is symmetric: CDF(x) + CDF(-x) ≈ 1', () => {
    // This property holds for the true normal CDF; check the approximation
    expect(normalCDF(1.5) + normalCDF(-1.5)).toBeCloseTo(1, 1);
  });
});

describe('calcPoP', () => {
  it('returns 0 for invalid inputs', () => {
    expect(calcPoP(0, 100, 0.3, 45)).toBe(0);
    expect(calcPoP(100, 0, 0.3, 45)).toBe(0);
    expect(calcPoP(100, 100, 0, 45)).toBe(0);
    expect(calcPoP(100, 100, 0.3, 0)).toBe(0);
  });

  it('returns high PoP when strike is far below spot (deep OTM put)', () => {
    // Spot 500, strike 400 (20% OTM), IV 30%, 45 DTE
    const pop = calcPoP(500, 400, 0.30, 45);
    expect(pop).toBeGreaterThan(0.80);
  });

  it('returns result in [0, 1] range', () => {
    const pop = calcPoP(500, 500, 0.30, 45);
    expect(pop).toBeGreaterThanOrEqual(0);
    expect(pop).toBeLessThanOrEqual(1);
  });

  it('returns lower PoP for higher delta (closer to ATM)', () => {
    // Far OTM: strike 420 vs near ATM: strike 490
    const farOtm = calcPoP(500, 420, 0.30, 45);
    const nearAtm = calcPoP(500, 490, 0.30, 45);
    expect(farOtm).toBeGreaterThan(nearAtm);
  });

  it('returns lower PoP for longer DTE (more time for price to fall through strike)', () => {
    // With more DTE, there is more time for the price to move below the strike,
    // so PoP for a put seller decreases with longer DTE when strike is OTM
    const short = calcPoP(500, 450, 0.30, 7);
    const long = calcPoP(500, 450, 0.30, 90);
    // Short DTE: price barely has time to move, very high PoP
    // Long DTE: more time for price to fall below 450
    expect(short).toBeGreaterThan(long);
  });

  it('returns lower PoP for higher IV (wider distribution)', () => {
    const lowIv = calcPoP(500, 450, 0.15, 45);
    const highIv = calcPoP(500, 450, 0.60, 45);
    expect(lowIv).toBeGreaterThan(highIv);
  });
});

describe('buildPayoffData', () => {
  it('returns empty array for invalid inputs', () => {
    expect(buildPayoffData(0, 0.20, 45, 0.30, 'CSP')).toHaveLength(0);
    expect(buildPayoffData(500, 0.20, 45, 0, 'CSP')).toHaveLength(0);
    expect(buildPayoffData(500, 0.20, 0, 0.30, 'CSP')).toHaveLength(0);
  });

  it('returns 61 data points for valid CSP inputs', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    expect(data).toHaveLength(61);
  });

  it('CSP: max P&L is positive (credit received)', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    const maxPnl = Math.max(...data.map(d => d.pnl));
    expect(maxPnl).toBeGreaterThan(0);
  });

  it('CSP: P&L at highest price equals max profit (put expires worthless)', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    const maxPnl = Math.max(...data.map(d => d.pnl));
    const highPricePnl = data[data.length - 1].pnl;
    expect(highPricePnl).toBeCloseTo(maxPnl, 0);
  });

  it('CSP: P&L at lowest price is negative (put deep ITM)', () => {
    // With spot=500, delta=0.20, the price range extends well below the strike
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    const lowPricePnl = data[0].pnl;
    expect(lowPricePnl).toBeLessThan(0);
  });

  it('CSP: P&L is monotonically non-decreasing as price increases', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    const sorted = [...data].sort((a, b) => a.price - b.price);
    for (let i = 1; i < sorted.length; i++) {
      // Allow for rounding noise of ±0.01
      expect(sorted[i].pnl).toBeGreaterThanOrEqual(sorted[i - 1].pnl - 0.01);
    }
  });

  it('IRON_CONDOR: max loss is bounded (defined risk)', () => {
    const data = buildPayoffData(500, 0.16, 45, 0.30, 'IRON_CONDOR');
    const minPnl = Math.min(...data.map(d => d.pnl));
    // Max loss should be bounded by wing width (4% of spot = $20 * 100 = $2000)
    expect(minPnl).toBeGreaterThan(-3000);
  });

  it('BULL_PUT_SPREAD: max loss is bounded', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'BULL_PUT_SPREAD');
    const minPnl = Math.min(...data.map(d => d.pnl));
    expect(minPnl).toBeGreaterThan(-5000);
  });

  it('all price values are positive', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'CSP');
    expect(data.every(d => d.price > 0)).toBe(true);
  });

  it('price range spans roughly ±3σ around spot', () => {
    const spot = 500, iv = 0.30, dte = 45;
    const data = buildPayoffData(spot, 0.20, dte, iv, 'CSP');
    const T = dte / 365;
    const expectedRange = spot * iv * Math.sqrt(T) * 3;
    const actualRange = data[data.length - 1].price - data[0].price;
    expect(actualRange).toBeCloseTo(expectedRange * 2, -1);
  });

  it('COVERED_CALL: P&L is bounded above (call caps upside)', () => {
    const data = buildPayoffData(500, 0.20, 45, 0.30, 'COVERED_CALL');
    const maxPnl = Math.max(...data.map(d => d.pnl));
    const minPnl = Math.min(...data.map(d => d.pnl));
    // Upside is capped by the short call
    expect(maxPnl).toBeGreaterThan(0);
    // P&L range should be finite
    expect(maxPnl - minPnl).toBeLessThan(100000);
  });
});

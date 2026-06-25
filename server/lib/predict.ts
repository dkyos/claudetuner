// Server port of the extension's 7-day prediction (ui/prediction.js
// calcPredictedAtReset, d7 branch): sum positive utilization increments within
// the same reset window over the last 6h to get a rate (%/h), then project to the
// reset time. Falls back to elapsed-time rate when recent data is thin.
import type { RecentSnapshot } from "./db";

export interface Prediction {
  rate: number; // %/hour (>= 0)
  predicted: number; // projected utilization at reset
  hoursToReset: number;
  reach100At: number | null; // epoch ms when 100% is projected, else null
}

export function predict7d(
  history: RecentSnapshot[],
  currentUtil: number | null,
  resetsAt: string | null,
  now = Date.now()
): Prediction | null {
  if (!resetsAt || currentUtil == null || history.length < 3) return null;
  const resetTime = Date.parse(resetsAt);
  if (!Number.isFinite(resetTime)) return null;
  const hoursToReset = Math.max((resetTime - now) / 3600000, 0);
  if (hoursToReset < 0.05) return null;

  let rate: number | null = null;
  const sixHoursAgo = now - 6 * 3600000;
  const recent = history.filter(
    (p) =>
      p.seven_day_utilization != null &&
      p.seven_day_resets_at &&
      Date.parse(p.collected_at) > sixHoursAgo
  );
  if (recent.length >= 2) {
    let totalDelta = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i - 1].seven_day_resets_at === recent[i].seven_day_resets_at) {
        totalDelta += Math.max(
          0,
          recent[i].seven_day_utilization! - recent[i - 1].seven_day_utilization!
        );
      }
    }
    const timeDiffH =
      (Date.parse(recent[recent.length - 1].collected_at) -
        Date.parse(recent[0].collected_at)) /
      3600000;
    if (timeDiffH > 0) rate = totalDelta / timeDiffH;
  }
  if (rate == null) {
    // Fallback: assume linear consumption over the elapsed part of the 7d window.
    const elapsed = 7 * 24 - hoursToReset;
    if (elapsed < 1) return null;
    rate = currentUtil / elapsed;
  }

  const predicted = currentUtil + rate * hoursToReset;
  const reach100At =
    predicted >= 100 && rate > 0 && currentUtil < 100
      ? now + ((100 - currentUtil) / rate) * 3600000
      : null;
  return { rate, predicted, hoursToReset, reach100At };
}

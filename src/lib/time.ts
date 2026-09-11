export function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function fmtPrecise(ms: number): string {
  const cs = Math.floor((Math.max(0, ms) % 1000) / 10);
  return fmt(ms) + '.' + String(cs).padStart(2, '0');
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

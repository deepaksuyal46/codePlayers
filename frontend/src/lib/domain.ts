import { createHash } from 'node:crypto';
export class AppError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function fail(status: number, code: string, message: string): never { throw new AppError(status,code,message); }
export const RESERVATION_MS = 180_000;
export const MAX_QUANTITY = 10;
export function fingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function total(lines: { quantity:number; unitPricePaise:number }[]) {
  const sum = lines.reduce((s,l) => {
    if (!Number.isSafeInteger(l.quantity)||l.quantity<1||l.quantity>MAX_QUANTITY||!Number.isSafeInteger(l.unitPricePaise)||l.unitPricePaise<0) fail(400,'VALIDATION_ERROR','Invalid price or quantity');
    return s+l.quantity*l.unitPricePaise;
  },0);
  if(!Number.isSafeInteger(sum)) fail(400,'VALIDATION_ERROR','Total exceeds limit');
  return sum;
}
export function remainingSeconds(expires: string, now: number) { return Math.max(0,Math.ceil((new Date(expires).getTime()-now)/1000)); }

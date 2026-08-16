export const DEFAULT_PIN_LENGTH = 4;

export function configuredPinLength(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 4 && Number(value) <= 6
    ? Number(value)
    : DEFAULT_PIN_LENGTH;
}

export function isCompletePin(pin: string, length: number): boolean {
  return pin.length === length && /^\d+$/.test(pin);
}

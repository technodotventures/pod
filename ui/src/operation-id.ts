const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function createOperationId(): string {
  const bytes = new Uint8Array(26);
  crypto.getRandomValues(bytes);
  let body = '';
  for (const byte of bytes) body += ULID_ALPHABET[byte % ULID_ALPHABET.length];
  return `op_${body}`;
}

import { spawn } from 'node:child_process';

const SECURITY_BINARY = '/usr/bin/security';
export const EMAIL_KEYCHAIN_SERVICE = 'ai.meetcoffee.pod.email';

export interface SecurityCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type SecurityCommandRunner = (args: string[], stdin?: string) => Promise<SecurityCommandResult>;

async function defaultSecurityRunner(args: string[], stdin?: string): Promise<SecurityCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(SECURITY_BINARY, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code: code ?? 1 }));
    if (stdin !== undefined) child.stdin.end(`${stdin}\n`);
    else child.stdin.end();
  });
}

function requireMacOS(): void {
  if (process.platform !== 'darwin') {
    throw new Error('macOS Keychain is available only in the Pod desktop app on macOS.');
  }
}

function cleanAccount(account: string): string {
  const cleaned = account.trim().toLowerCase();
  if (!cleaned || cleaned.length > 320 || !cleaned.includes('@')) throw new Error('Enter a valid email address.');
  return cleaned;
}

export async function storeEmailPassword(
  account: string,
  password: string,
  runner: SecurityCommandRunner = defaultSecurityRunner,
  allowNonMacForTest = false,
): Promise<void> {
  if (!allowNonMacForTest) requireMacOS();
  const cleaned = cleanAccount(account);
  if (!password.trim()) throw new Error('Enter an app-specific password.');
  // Omitting the value after -w makes `security` read it from stdin, keeping
  // the credential out of process arguments and Pod logs.
  const result = await runner([
    'add-generic-password', '-U', '-a', cleaned, '-s', EMAIL_KEYCHAIN_SERVICE, '-w',
  ], password);
  if (result.code !== 0) throw new Error('Could not save the email password in macOS Keychain.');
}

export async function readEmailPassword(
  account: string,
  runner: SecurityCommandRunner = defaultSecurityRunner,
  allowNonMacForTest = false,
): Promise<string> {
  if (!allowNonMacForTest) requireMacOS();
  const result = await runner([
    'find-generic-password', '-a', cleanAccount(account), '-s', EMAIL_KEYCHAIN_SERVICE, '-w',
  ]);
  const password = result.stdout.trim();
  if (result.code !== 0 || !password) throw new Error('Email password is missing from macOS Keychain.');
  return password;
}

export async function deleteEmailPassword(
  account: string,
  runner: SecurityCommandRunner = defaultSecurityRunner,
  allowNonMacForTest = false,
): Promise<void> {
  if (!allowNonMacForTest) requireMacOS();
  const result = await runner([
    'delete-generic-password', '-a', cleanAccount(account), '-s', EMAIL_KEYCHAIN_SERVICE,
  ]);
  // `security` returns 44 when an item is already absent. Disconnect remains
  // idempotent in that case.
  if (result.code !== 0 && result.code !== 44) throw new Error('Could not remove the email password from macOS Keychain.');
}

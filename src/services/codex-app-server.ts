import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

type JsonObject = Record<string, unknown>;

export interface CodexAccountStatus {
  available: boolean;
  connected: boolean;
  auth_mode: 'chatgpt' | 'api_key' | null;
  email: string | null;
  plan_type: string | null;
  message?: string;
}

export interface CodexLoginStart {
  login_id: string;
  mode: 'browser' | 'device';
  auth_url?: string;
  verification_url?: string;
  user_code?: string;
}

interface PendingRequest {
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const MAC_CODEX_PATH = '/Applications/ChatGPT.app/Contents/Resources/codex';

export function codexAccountStatusFromResult(result: JsonObject): CodexAccountStatus {
  const account = result.account && typeof result.account === 'object' ? result.account as JsonObject : null;
  const type = account?.type;
  return {
    available: true,
    connected: type === 'chatgpt' || type === 'apiKey',
    auth_mode: type === 'chatgpt' ? 'chatgpt' : type === 'apiKey' ? 'api_key' : null,
    email: typeof account?.email === 'string' ? account.email : null,
    plan_type: typeof account?.planType === 'string' ? account.planType : null,
  };
}

export function codexLoginStartFromResult(result: JsonObject, mode: 'browser' | 'device'): CodexLoginStart {
  if (typeof result.loginId !== 'string') throw new Error('Codex returned no login identifier.');
  return {
    login_id: result.loginId,
    mode,
    auth_url: typeof result.authUrl === 'string' ? result.authUrl : undefined,
    verification_url: typeof result.verificationUrl === 'string' ? result.verificationUrl : undefined,
    user_code: typeof result.userCode === 'string' ? result.userCode : undefined,
  };
}

export function codexTextFromCompletedTurn(turn: JsonObject): string {
  if (turn.status === 'failed') throw new Error('Codex generation failed.');
  const items = Array.isArray(turn.items) ? turn.items as JsonObject[] : [];
  const answer = items
    .filter(item => item.type === 'agentMessage' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n')
    .trim();
  if (!answer) throw new Error('Codex returned no text.');
  return answer;
}

async function resolveCodexCommand(): Promise<string> {
  const explicit = process.env['COFFEE_POD_CODEX_PATH']?.trim();
  if (explicit) return explicit;
  if (process.platform === 'darwin') {
    try {
      await access(MAC_CODEX_PATH, constants.X_OK);
      return MAC_CODEX_PATH;
    } catch { /* fall through to PATH */ }
  }
  return 'codex';
}

export class CodexAppServer {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private ready: Promise<void> | null = null;
  private loginResults = new Map<string, { success: boolean; error: string | null }>();
  private turnWaiters = new Map<string, { resolve: (turn: JsonObject) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  private async start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const command = await resolveCodexCommand();
      const child = spawn(command, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.child = child;
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => this.handleLine(line));
      let stderr = '';
      child.stderr.on('data', chunk => { stderr = `${stderr}${String(chunk)}`.slice(-4000); });
      child.on('error', error => this.failAll(error));
      child.on('close', code => {
        this.child = null;
        this.ready = null;
        this.failAll(new Error(stderr.trim() || `Codex app-server exited (${code ?? 'unknown'}).`));
      });
      await this.requestRaw('initialize', {
        clientInfo: { name: 'coffee-pod', title: 'Pod by Coffee', version: '0.1.0' },
        capabilities: {
          experimentalApi: false,
          requestAttestation: false,
          optOutNotificationMethods: [],
        },
      });
      this.notify('initialized', {});
    })().catch(error => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  private handleLine(line: string): void {
    let message: JsonObject;
    try { message = JSON.parse(line) as JsonObject; } catch { return; }
    if (typeof message.id === 'number') {
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(message.id);
      if (message.error && typeof message.error === 'object') {
        const error = message.error as JsonObject;
        request.reject(new Error(typeof error.message === 'string' ? error.message : 'Codex request failed.'));
      } else {
        request.resolve((message.result && typeof message.result === 'object' ? message.result : {}) as JsonObject);
      }
      return;
    }
    if (message.method === 'account/login/completed' && message.params && typeof message.params === 'object') {
      const params = message.params as JsonObject;
      if (typeof params.loginId === 'string') {
        this.loginResults.set(params.loginId, {
          success: params.success === true,
          error: typeof params.error === 'string' ? params.error : null,
        });
      }
    }
    if (message.method === 'turn/completed' && message.params && typeof message.params === 'object') {
      const params = message.params as JsonObject;
      const turn = params.turn && typeof params.turn === 'object' ? params.turn as JsonObject : null;
      if (typeof turn?.id === 'string') {
        const waiter = this.turnWaiters.get(turn.id);
        if (waiter) {
          clearTimeout(waiter.timer);
          this.turnWaiters.delete(turn.id);
          waiter.resolve(turn);
        }
      }
    }
  }

  private requestRaw(method: string, params: unknown, timeoutMs = 15_000): Promise<JsonObject> {
    const child = this.child;
    if (!child?.stdin.writable) return Promise.reject(new Error('Codex app-server is not running.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  private notify(method: string, params: unknown): void {
    if (this.child?.stdin.writable) this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private async request(method: string, params: unknown = undefined, timeoutMs?: number): Promise<JsonObject> {
    await this.start();
    return this.requestRaw(method, params, timeoutMs);
  }

  private failAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    for (const waiter of this.turnWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.turnWaiters.clear();
  }

  async status(): Promise<CodexAccountStatus> {
    try {
      const result = await this.request('account/read', { refreshToken: false });
      return codexAccountStatusFromResult(result);
    } catch (error) {
      return {
        available: false,
        connected: false,
        auth_mode: null,
        email: null,
        plan_type: null,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async login(mode: 'browser' | 'device'): Promise<CodexLoginStart> {
    const result = await this.request('account/login/start', mode === 'device'
      ? { type: 'chatgptDeviceCode' }
      : { type: 'chatgpt', codexStreamlinedLogin: true, appBrand: 'codex' });
    const login = codexLoginStartFromResult(result, mode);
    this.loginResults.delete(login.login_id);
    return login;
  }

  loginStatus(loginId: string): { state: 'pending' | 'connected' | 'failed'; message?: string } {
    const result = this.loginResults.get(loginId);
    if (!result) return { state: 'pending' };
    return result.success ? { state: 'connected' } : { state: 'failed', message: result.error ?? 'Authorization failed.' };
  }

  async cancel(loginId: string): Promise<void> {
    await this.request('account/login/cancel', { loginId });
    this.loginResults.delete(loginId);
  }

  async logout(): Promise<void> {
    await this.request('account/logout');
    this.loginResults.clear();
  }

  async generateText(options: { system?: string; prompt: string; maxTokens?: number }): Promise<string> {
    const status = await this.status();
    if (!status.connected || status.auth_mode !== 'chatgpt') throw new Error('Codex is not connected with ChatGPT.');
    const threadResult = await this.request('thread/start', {
      cwd: process.cwd(),
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
      serviceName: 'Pod reflection',
      baseInstructions: 'Return only the requested text. Do not use tools, inspect files, or take actions.',
    });
    const thread = threadResult.thread && typeof threadResult.thread === 'object' ? threadResult.thread as JsonObject : null;
    if (typeof thread?.id !== 'string') throw new Error('Codex returned no thread identifier.');
    const combined = [options.system ? `System instructions:\n${options.system}` : '', options.prompt].filter(Boolean).join('\n\n');
    const turnResult = await this.request('turn/start', {
      threadId: thread.id,
      input: [{ type: 'text', text: combined, text_elements: [] }],
      outputSchema: null,
    });
    const turn = turnResult.turn && typeof turnResult.turn === 'object' ? turnResult.turn as JsonObject : null;
    if (typeof turn?.id !== 'string') throw new Error('Codex returned no turn identifier.');
    const completed = await new Promise<JsonObject>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turnWaiters.delete(turn.id as string);
        reject(new Error('Codex generation timed out.'));
      }, 60_000);
      this.turnWaiters.set(turn.id as string, { resolve, reject, timer });
    });
    return codexTextFromCompletedTurn(completed);
  }

  close(): void {
    this.child?.kill();
    this.child = null;
    this.ready = null;
  }
}

export const codexAppServer = new CodexAppServer();

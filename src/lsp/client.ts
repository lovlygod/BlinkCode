export type JsonRpcId = number | string;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

type Pending = {
  resolve: (value: any) => void;
  reject: (err: any) => void;
};

type NotificationHandler = (params: any) => void;

export class LspClient {
  private ws: WebSocket | null = null;
  private url: string;
  private nextId = 1;
  private pending = new Map<JsonRpcId, Pending>();
  private notifHandlers = new Map<string, NotificationHandler[]>();
  private ready = false;
  private readyQueue: (() => void)[] = [];
  private initializeParams: any;
  private onCloseCb: (() => void) | null = null;
  private reconnectTimer: number | null = null;
  private closedByUser = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string, initializeParams: any) {
    this.url = url;
    this.initializeParams = initializeParams;
  }

  async connect(): Promise<void> {
    this.closedByUser = false;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
      ws.onmessage = (ev) => this.onMessage(ev.data);
      ws.onclose = () => {
        this.ready = false;
        this.ws = null;
        if (this.onCloseCb) this.onCloseCb();
        for (const [, p] of this.pending) p.reject(new Error('LSP connection closed'));
        this.pending.clear();
        if (!this.closedByUser) this.scheduleReconnect();
      };
    });

    const result = await this.request('initialize', this.initializeParams);
    this.notify('initialized', {});
    this.ready = true;
    this.reconnectAttempts = 0;
    const q = this.readyQueue.slice();
    this.readyQueue.length = 0;
    for (const fn of q) fn();
    return result;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer != null) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(30000, 2000 * Math.pow(2, this.reconnectAttempts - 1));
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      try { await this.connect(); } catch { this.scheduleReconnect(); }
    }, delay);
  }

  onClose(cb: () => void) {
    this.onCloseCb = cb;
  }

  whenReady(fn: () => void) {
    if (this.ready) fn();
    else this.readyQueue.push(fn);
  }

  isReady() { return this.ready; }

  private onMessage(raw: any) {
    let msg: any;
    try { msg = JSON.parse(typeof raw === 'string' ? raw : String(raw)); } catch { return; }
    if (Array.isArray(msg)) {
      for (const m of msg) this.dispatch(m);
    } else {
      this.dispatch(msg);
    }
  }

  private dispatch(msg: any) {
    if (msg && typeof msg === 'object' && 'id' in msg && !('method' in msg)) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(msg.error);
        else p.resolve(msg.result);
      }
      return;
    }
    if (msg && typeof msg === 'object' && 'method' in msg) {
      if ('id' in msg) {
        this.send({ jsonrpc: '2.0', id: msg.id, result: null });
        return;
      }
      const handlers = this.notifHandlers.get(msg.method);
      if (handlers) for (const h of handlers) {
        try { h(msg.params); } catch {}
      }
    }
  }

  private send(msg: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse) {
    if (!this.ws || this.ws.readyState !== 1) return;
    try { this.ws.send(JSON.stringify(msg)); } catch {}
  }

  request<T = any>(method: string, params?: any, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws) { reject(new Error('LSP not connected')); return; }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error(`LSP request ${method} timed out`));
          }
        }, timeoutMs);
      }
    });
  }

  notify(method: string, params?: any) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  on(method: string, handler: NotificationHandler) {
    const arr = this.notifHandlers.get(method) || [];
    arr.push(handler);
    this.notifHandlers.set(method, arr);
    return () => {
      const cur = this.notifHandlers.get(method) || [];
      const idx = cur.indexOf(handler);
      if (idx >= 0) cur.splice(idx, 1);
    };
  }

  async shutdown() {
    this.closedByUser = true;
    if (this.reconnectTimer != null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { await this.request('shutdown', null, 2000); } catch {}
    try { this.notify('exit'); } catch {}
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.ready = false;
  }
}

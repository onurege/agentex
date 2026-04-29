// ============================================================
// Yargı MCP Client
// ============================================================
//
// Minimal Streamable HTTP MCP client for the public Yargı MCP
// endpoint. This stays server-side; the browser never sees MCP
// session headers or request details.
// ============================================================

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPCallResult {
  content?: Array<{ type?: string; text?: string }>;
  [key: string]: unknown;
}

interface MCPResponse<T = unknown> {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: { code?: number; message?: string };
}

const DEFAULT_ENDPOINT = "https://yargimcp.fastmcp.app/mcp";
const PROTOCOL_VERSION = "2024-11-05";

function getEndpoint(): string {
  return process.env.YARGI_MCP_URL?.trim() || DEFAULT_ENDPOINT;
}

function requestTimeoutMs(): number {
  const raw = Number(process.env.YARGI_MCP_TIMEOUT_MS ?? "12000");
  return Number.isFinite(raw) && raw > 1000 ? raw : 12000;
}

function parseSSE(text: string): unknown {
  const dataLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]);
    } catch {
      // Keep looking; FastMCP may emit comments or non-result frames.
    }
  }
  return null;
}

async function parseMCPResponse<T>(response: Response): Promise<MCPResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const parsed = contentType.includes("text/event-stream")
    ? parseSSE(text)
    : text
      ? JSON.parse(text)
      : null;

  const payload = parsed as MCPResponse<T> | null;
  if (!payload) {
    throw new Error("Yargı MCP boş yanıt döndürdü.");
  }
  if (payload.error) {
    throw new Error(payload.error.message ?? "Yargı MCP hata döndürdü.");
  }
  return payload;
}

function makeBody(method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    params,
  };
}

async function postMCP<T>(
  method: string,
  params?: Record<string, unknown>,
  sessionId?: string | null,
): Promise<{ result: T; sessionId: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify(makeBody(method, params)),
    signal: AbortSignal.timeout(requestTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`Yargı MCP HTTP ${response.status}`);
  }

  const parsed = await parseMCPResponse<T>(response);
  return {
    result: parsed.result as T,
    sessionId: response.headers.get("mcp-session-id") ?? sessionId ?? null,
  };
}

async function notifyInitialized(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    await postMCP("notifications/initialized", undefined, sessionId);
  } catch {
    // Some deployments do not require the initialized notification
    // over HTTP; ignore so list/call can still proceed.
  }
}

// Module-level cache for tools/list. The Yargı MCP tool roster is stable
// for long stretches; without this, every boardroom run pays an extra
// round-trip (and the listTools call requires its own initialize round-trip
// before it). Clients can opt out of the cache for diagnostics.
const TOOLS_TTL_MS = 60 * 60 * 1000;
let toolsCache: { tools: MCPTool[]; expiresAt: number } | null = null;

export class YargiMCPClient {
  private sessionId: string | null = null;

  readonly endpoint = getEndpoint();

  async initialize(): Promise<void> {
    const { sessionId } = await postMCP<unknown>("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "consulera", version: "0.1.0" },
    });
    this.sessionId = sessionId;
    await notifyInitialized(this.sessionId);
  }

  async listTools(options?: { skipCache?: boolean }): Promise<MCPTool[]> {
    const now = Date.now();
    if (!options?.skipCache && toolsCache && toolsCache.expiresAt > now) {
      return toolsCache.tools;
    }
    if (!this.sessionId) await this.initialize();
    const { result } = await postMCP<{ tools?: MCPTool[] }>(
      "tools/list",
      undefined,
      this.sessionId,
    );
    const tools = result.tools ?? [];
    toolsCache = { tools, expiresAt: now + TOOLS_TTL_MS };
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    if (!this.sessionId) await this.initialize();
    const { result } = await postMCP<MCPCallResult>(
      "tools/call",
      { name, arguments: args },
      this.sessionId,
    );
    return result;
  }
}

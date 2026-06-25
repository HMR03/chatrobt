// SQLite 存储服务 — Tauri 环境使用 SQLite，浏览器回退到内存 mock

import type { Conversation, Message, Memory } from "../types";

// ---------- 数据库初始化 ----------

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_calls TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fact',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_persona ON memories(persona_id);
CREATE INDEX IF NOT EXISTS idx_conversations_persona ON conversations(persona_id);
`;

let db: any = null;
let dbInitialized = false;
let usingMock = false;
let initError: string | null = null;

export async function initDatabase(): Promise<any> {
  if (dbInitialized) return db;

  try {
    console.log("[Storage] Attempting to load @tauri-apps/plugin-sql...");
    const sqlPlugin = await import("@tauri-apps/plugin-sql");
    const Database = sqlPlugin.default;
    console.log("[Storage] SQL plugin loaded, opening database...");
    db = await Database.load("sqlite:chatbot.db");
    console.log("[Storage] Database opened, running migrations...");
    await db.execute(INIT_SQL);
    console.log("[Storage] ✅ SQLite initialized successfully at chatbot.db");
    usingMock = false;
    dbInitialized = true;
    return db;
  } catch (err: any) {
    initError = err.message || String(err);
    console.warn("[Storage] ⚠️  SQLite unavailable, using in-memory mock");
    console.warn("[Storage]    Reason:", initError);
    console.warn("[Storage]    (This is normal in browser dev mode. Run 'npm run tauri dev' for SQLite.)");
    db = createMemoryDB();
    usingMock = true;
    dbInitialized = true;
    return db;
  }
}

export function getDatabase(): any {
  return db;
}

export function isUsingMock(): boolean {
  return usingMock;
}

export function getInitError(): string | null {
  return initError;
}

// ---------- 内存数据库 Mock（浏览器开发用） ----------

function createMemoryDB() {
  const conversations = new Map<string, any>();
  const messages = new Map<string, any[]>();
  const memories: any[] = [];

  return {
    execute: async (sql: string, params?: any[]) => {
      if (sql.includes("INSERT") && sql.includes("conversations")) {
        const [id, personaId, title, createdAt, updatedAt] = params || [];
        conversations.set(id, { id, persona_id: personaId, title, created_at: createdAt, updated_at: updatedAt });
      } else if (sql.includes("INSERT OR REPLACE") && sql.includes("messages")) {
        const [id, convId, role, content, toolCallId, toolCalls, timestamp] = params || [];
        if (!messages.has(convId)) messages.set(convId, []);
        const existing = messages.get(convId)!;
        const idx = existing.findIndex((m: any) => m.id === id);
        const msg = { id, conversation_id: convId, role, content, tool_call_id: toolCallId, tool_calls: toolCalls, timestamp };
        if (idx >= 0) existing[idx] = msg;
        else existing.push(msg);
      } else if (sql.includes("INSERT") && sql.includes("memories")) {
        const [id, personaId, content, category, createdAt] = params || [];
        memories.push({ id, persona_id: personaId, content, category, created_at: createdAt });
      } else if (sql.includes("DELETE FROM conversations")) {
        const [id] = params || [];
        conversations.delete(id);
        messages.delete(id);
      } else if (sql.includes("DELETE FROM messages") && sql.includes("conversation_id")) {
        const [convId] = params || [];
        messages.delete(convId);
      } else if (sql.includes("DELETE FROM memories")) {
        // handled separately
      } else if (sql.includes("UPDATE conversations")) {
        const [title, updatedAt, id] = params || [];
        const conv = conversations.get(id);
        if (conv) { conv.title = title; conv.updated_at = updatedAt; }
      } else if (sql.includes("CREATE") || sql.includes("INDEX")) {
        // DDL, no-op in mock
      }
    },
    select: async (sql: string, params?: any[]) => {
      if (sql.includes("FROM conversations")) {
        const personaId = params?.[0];
        return Array.from(conversations.values())
          .filter((c: any) => !personaId || c.persona_id === personaId)
          .sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at));
      }
      if (sql.includes("FROM messages")) {
        const convId = params?.[0];
        return (messages.get(convId) || [])
          .sort((a: any, b: any) => a.timestamp - b.timestamp);
      }
      if (sql.includes("FROM memories")) {
        const personaId = params?.[0];
        return memories
          .filter((m: any) => m.persona_id === personaId)
          .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
      }
      return [];
    },
    close: async () => {},
  };
}

// ---------- 会话操作 ----------

export const ConversationStore = {
  async create(personaId: string, title?: string, id?: string): Promise<Conversation> {
    if (!db) throw new Error("Database not initialized");
    const convId = id || Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO conversations (id, persona_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [convId, personaId, title || "新对话", now, now]
    );
    console.log("[Storage] Conversation created:", convId.slice(0, 8), title || "新对话");
    return {
      id: convId,
      personaId,
      title: title || "新对话",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateTitle(id: string, title: string) {
    if (!db) return;
    const now = new Date().toISOString();
    await db.execute(
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
      [title.slice(0, 30), now, id]
    );
  },

  async listByPersona(personaId: string): Promise<Conversation[]> {
    if (!db) return [];
    const rows = await db.select(
      "SELECT * FROM conversations WHERE persona_id = ? ORDER BY updated_at DESC",
      [personaId]
    );
    console.log("[Storage] Loaded", rows.length, "conversations for persona", personaId);
    return rows.map((row: any) => ({
      id: row.id,
      personaId: row.persona_id,
      title: row.title,
      messages: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async delete(id: string) {
    if (!db) return;
    // Delete messages first (cascade may not work in all setups)
    await db.execute("DELETE FROM messages WHERE conversation_id = ?", [id]);
    await db.execute("DELETE FROM conversations WHERE id = ?", [id]);
    console.log("[Storage] Conversation deleted:", id.slice(0, 8));
  },
};

// ---------- 消息操作 ----------

export const MessageStore = {
  async save(conversationId: string, message: Message) {
    if (!db) return;
    await db.execute(
      "INSERT OR REPLACE INTO messages (id, conversation_id, role, content, tool_call_id, tool_calls, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        message.id,
        conversationId,
        message.role,
        message.content,
        message.toolCallId || null,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.timestamp,
      ]
    );
  },

  async saveBatch(conversationId: string, messages: Message[]) {
    if (!db) return;
    // Delete existing messages for this conversation, then re-insert all
    await db.execute("DELETE FROM messages WHERE conversation_id = ?", [conversationId]);
    for (const msg of messages) {
      if (msg.role === "system") continue; // Don't persist system messages
      await db.execute(
        "INSERT INTO messages (id, conversation_id, role, content, tool_call_id, tool_calls, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          msg.id,
          conversationId,
          msg.role,
          msg.content,
          msg.toolCallId || null,
          msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          msg.timestamp,
        ]
      );
    }
    console.log("[Storage] Saved", messages.filter(m => m.role !== "system").length, "messages for conv", conversationId.slice(0, 8));
  },

  async loadByConversation(conversationId: string): Promise<Message[]> {
    if (!db) return [];
    const rows = await db.select(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      [conversationId]
    );
    console.log("[Storage] Loaded", rows.length, "messages for conv", conversationId.slice(0, 8));
    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      toolCallId: row.tool_call_id || undefined,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      timestamp: row.timestamp,
    }));
  },
};

// ---------- 记忆操作 ----------

export const MemoryStore = {
  async save(memory: Omit<Memory, "id" | "createdAt">): Promise<string> {
    if (!db) throw new Error("Database not initialized");
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO memories (id, persona_id, content, category, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, memory.personaId, memory.content, memory.category, now]
    );
    return id;
  },

  async loadByPersona(personaId: string): Promise<Memory[]> {
    if (!db) return [];
    const rows = await db.select(
      "SELECT * FROM memories WHERE persona_id = ? ORDER BY created_at DESC LIMIT 50",
      [personaId]
    );
    return rows.map((row: any) => ({
      id: row.id,
      personaId: row.persona_id,
      content: row.content,
      category: row.category,
      createdAt: row.created_at,
    }));
  },

  async delete(id: string) {
    if (!db) return;
    await db.execute("DELETE FROM memories WHERE id = ?", [id]);
  },

  async clearByPersona(personaId: string) {
    if (!db) return;
    await db.execute("DELETE FROM memories WHERE persona_id = ?", [personaId]);
  },
};

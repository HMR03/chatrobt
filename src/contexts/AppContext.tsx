import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Persona, Skill, Memory, AppConfig, Conversation } from "../types";
import { BUILTIN_PERSONAS, BUILTIN_SKILLS } from "../services/persona";
import { initDatabase, getDatabase, isUsingMock, getInitError, ConversationStore, MessageStore, MemoryStore } from "../services/storage";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface AppState {
  config: AppConfig;
  updateConfig: (partial: Partial<AppConfig>) => void;

  personas: Persona[];
  currentPersonaId: string;
  currentPersona: Persona;
  setCurrentPersonaId: (id: string) => void;
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, partial: Partial<Persona>) => void;
  deletePersona: (id: string) => void;

  skills: Skill[];
  updateSkill: (id: string, partial: Partial<Skill>) => void;
  toggleSkill: (id: string) => void;

  conversations: Conversation[];
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  addConversation: (conv: Conversation) => Promise<void>;
  updateConversation: (id: string, partial: Partial<Conversation>) => void;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: (personaId: string) => Promise<void>;
  saveCurrentMessages: (convId: string, messages: import("../types").Message[]) => Promise<void>;

  memories: Memory[];
  addMemories: (memories: Omit<Memory, "id" | "createdAt">[]) => void;
  deleteMemory: (id: string) => void;

  theme: "light" | "dark";
  toggleTheme: () => void;
  showPersonaEditor: boolean;
  setShowPersonaEditor: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;

  isCreatingPersona: boolean;
  startCreatePersona: () => void;
  cancelCreatePersona: () => void;

  dbReady: boolean;
  dbUsingMock: boolean;
}

const defaultConfig: AppConfig = {
  apiKey: "",
  defaultModel: "deepseek-v4-flash",
  theme: "dark",
  sendKey: "enter",
  language: "zh",
  globalShortcut: "Alt+Space",
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ============ Storage init ============
  const [dbReady, setDbReady] = useState(false);
  const [dbUsingMock, setDbUsingMock] = useState(false);
  const dbRef = useRef<any>(null);

  useEffect(() => {
    initDatabase().then((database) => {
      dbRef.current = database;
      setDbUsingMock(isUsingMock());
      setDbReady(true);
      const mockInfo = isUsingMock() ? ` (mock — ${getInitError()})` : "";
      console.log(`[AppContext] Database ready${mockInfo}`);
    });
  }, []);

  // ============ 配置 ============
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem("app-config");
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  });

  const updateConfig = useCallback((partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("app-config", JSON.stringify(next));
      return next;
    });
  }, []);

  // ============ 人格 ============
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const saved = localStorage.getItem("personas");
      if (saved) {
        const parsed = JSON.parse(saved);
        const ids = new Set(parsed.map((p: Persona) => p.id));
        let all = [...parsed];
        for (const bp of BUILTIN_PERSONAS) {
          if (!ids.has(bp.id)) all.push(bp);
        }
        return all;
      }
      return BUILTIN_PERSONAS;
    } catch {
      return BUILTIN_PERSONAS;
    }
  });

  useEffect(() => {
    setPersonas((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      let changed = false;
      const next = [...prev];
      for (const bp of BUILTIN_PERSONAS) {
        if (!ids.has(bp.id)) {
          next.push(bp);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const [currentPersonaId, setCurrentPersonaId] = useState<string>(
    () => localStorage.getItem("current-persona-id") || "assistant"
  );

  const currentPersona = personas.find((p) => p.id === currentPersonaId) || personas[0];

  const persistPersonas = (list: Persona[]) => {
    localStorage.setItem("personas", JSON.stringify(list));
  };

  const addPersona = useCallback((persona: Persona) => {
    setPersonas((prev) => {
      const next = [...prev, persona];
      persistPersonas(next);
      return next;
    });
    setCurrentPersonaId(persona.id);
  }, []);

  const updatePersona = useCallback((id: string, partial: Partial<Persona>) => {
    setPersonas((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, ...partial, updatedAt: new Date().toISOString() } : p
      );
      persistPersonas(next);
      return next;
    });
  }, []);

  const deletePersona = useCallback((id: string) => {
    setPersonas((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.isBuiltin) return prev;
      const next = prev.filter((p) => p.id !== id);
      persistPersonas(next);
      return next;
    });
    if (currentPersonaId === id) {
      setCurrentPersonaId((prev) => {
        const remaining = personas.filter((p) => p.id !== id);
        return remaining[0]?.id || "assistant";
      });
    }
  }, [currentPersonaId, personas]);

  // ============ 技能 ============
  const [skills, setSkills] = useState<Skill[]>(() => {
    try {
      const saved = localStorage.getItem("skills");
      return saved ? JSON.parse(saved) : BUILTIN_SKILLS;
    } catch {
      return BUILTIN_SKILLS;
    }
  });

  const updateSkill = useCallback((id: string, partial: Partial<Skill>) => {
    setSkills((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...partial } : s));
      localStorage.setItem("skills", JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSkills((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      localStorage.setItem("skills", JSON.stringify(next));
      return next;
    });
  }, []);

  // ============ 会话（with SQLite persistence） ============
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Load conversations from DB when persona switches or DB becomes ready
  const refreshConversations = useCallback(async (personaId: string) => {
    if (!dbRef.current) return;
    try {
      const list = await ConversationStore.listByPersona(personaId);
      setConversations(list);
    } catch (err) {
      console.error("[AppContext] Failed to load conversations:", err);
    }
  }, []);

  // Auto-load when DB is ready
  useEffect(() => {
    if (dbReady && currentPersonaId) {
      refreshConversations(currentPersonaId);
    }
  }, [dbReady, currentPersonaId, refreshConversations]);

  const addConversation = useCallback(async (conv: Conversation) => {
    setConversations((prev) => [conv, ...prev]);
    // Persist to DB
    try {
      if (dbRef.current) {
        await ConversationStore.create(conv.personaId, conv.title, conv.id);
        // Re-fetch to get correct timestamp
        await refreshConversations(conv.personaId);
      }
    } catch (err) {
      console.error("[AppContext] Failed to save conversation:", err);
    }
  }, [refreshConversations]);

  const updateConversation = useCallback((id: string, partial: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...partial } : c))
    );
    // Update title in DB
    if (partial.title && dbRef.current) {
      ConversationStore.updateTitle(id, partial.title).catch((err) =>
        console.error("[AppContext] Failed to update conversation title:", err)
      );
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) setCurrentConversationId(null);
    // Delete from DB
    try {
      if (dbRef.current) {
        await ConversationStore.delete(id);
      }
    } catch (err) {
      console.error("[AppContext] Failed to delete conversation:", err);
    }
  }, [currentConversationId]);

  // Save all current messages for a conversation
  const saveCurrentMessages = useCallback(async (convId: string, messages: import("../types").Message[]) => {
    if (!dbRef.current) return;
    try {
      await MessageStore.saveBatch(convId, messages);
      // Also update conversation updated_at
      await ConversationStore.updateTitle(convId, conversations.find(c => c.id === convId)?.title || "新对话");
    } catch (err) {
      console.error("[AppContext] Failed to save messages:", err);
    }
  }, [conversations]);

  // ============ 记忆（with SQLite persistence） ============
  const [memories, setMemories] = useState<Memory[]>([]);

  // Load memories when persona switches or DB becomes ready
  useEffect(() => {
    if (dbReady && currentPersonaId) {
      MemoryStore.loadByPersona(currentPersonaId)
        .then(setMemories)
        .catch((err) => console.error("[AppContext] Failed to load memories:", err));
    }
  }, [dbReady, currentPersonaId]);

  const addMemories = useCallback((newMemories: Omit<Memory, "id" | "createdAt">[]) => {
    setMemories((prev) => {
      const next = [...prev];
      for (const nm of newMemories) {
        const id = generateId();
        const memory: Memory = { ...nm, id, createdAt: new Date().toISOString() };
        next.push(memory);
        // Persist to DB
        if (dbRef.current) {
          MemoryStore.save(nm).catch((err) =>
            console.error("[AppContext] Failed to save memory:", err)
          );
        }
      }
      return next;
    });
  }, []);

  const deleteMemory = useCallback((id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    if (dbRef.current) {
      MemoryStore.delete(id).catch((err) =>
        console.error("[AppContext] Failed to delete memory:", err)
      );
    }
  }, []);

  // ============ 主题 ============
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      updateConfig({ theme: next });
      return next;
    });
  }, [updateConfig]);

  // ============ UI 状态 ============
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);

  const startCreatePersona = useCallback(() => {
    setIsCreatingPersona(true);
    setShowPersonaEditor(true);
  }, []);

  const cancelCreatePersona = useCallback(() => {
    setIsCreatingPersona(false);
    setShowPersonaEditor(false);
  }, []);

  const value: AppState = {
    config,
    updateConfig,
    personas,
    currentPersonaId,
    currentPersona: currentPersona || personas[0],
    setCurrentPersonaId,
    addPersona,
    updatePersona,
    deletePersona,
    skills,
    updateSkill,
    toggleSkill,
    conversations,
    currentConversationId,
    setCurrentConversationId,
    addConversation,
    updateConversation,
    deleteConversation,
    refreshConversations,
    saveCurrentMessages,
    memories,
    addMemories,
    deleteMemory,
    theme,
    toggleTheme,
    showPersonaEditor,
    setShowPersonaEditor,
    showSettings,
    setShowSettings,
    isCreatingPersona,
    startCreatePersona,
    cancelCreatePersona,
    dbReady,
    dbUsingMock,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

import { useCallback, useEffect, useRef } from "react";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { useChat } from "./hooks/useChat";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { PersonaEditor } from "./components/PersonaEditor";
import { SettingsDialog } from "./components/SettingsDialog";
import { MessageStore, ConversationStore } from "./services/storage";
import type { Conversation } from "./types";

// Strip newlines, take first 15 chars
function makeTitle(content: string): string {
  return content.replace(/\n/g, " ").replace(/\s+/g, " ").trim().slice(0, 15);
}

function ChatApp() {
  const ctx = useAppContext();
  const {
    config,
    personas,
    currentPersonaId,
    currentPersona,
    setCurrentPersonaId,
    updatePersona,
    deletePersona,
    addPersona,
    skills,
    toggleSkill,
    conversations,
    currentConversationId,
    setCurrentConversationId,
    addConversation,
    updateConversation,
    deleteConversation,
    saveCurrentMessages,
    memories,
    addMemories,
    theme,
    toggleTheme,
    showPersonaEditor,
    setShowPersonaEditor,
    showSettings,
    setShowSettings,
    updateConfig,
    isCreatingPersona,
    startCreatePersona,
    cancelCreatePersona,
  } = ctx;

  const {
    messages,
    isLoading,
    sendMessage: chatSend,
    stopGeneration,
    clearMessages,
    loadMessages,
  } = useChat({
    apiKey: config.apiKey,
    persona: currentPersona,
    skills,
    memories,
    onMemoriesExtracted: addMemories,
  });

  // Ref to always have current conversation ID in effects, avoiding stale closures
  const convIdRef = useRef(currentConversationId);
  useEffect(() => {
    convIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // ── Persistence: auto-save when send completes ──
  const prevLoadingRef = useRef(isLoading);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const nowNotLoading = !isLoading;

    if (wasLoading && nowNotLoading) {
      const convId = convIdRef.current;
      const hasContent = messages.some(m => m.role === "user" || m.role === "assistant");
      if (convId && hasContent) {
        console.log("[App] Send completed, persisting", messages.length, "messages to conv", convId.slice(0, 8));
        saveCurrentMessages(convId, messages);
      }
    }

    prevLoadingRef.current = isLoading;
  }, [isLoading, messages, saveCurrentMessages]);

  // ── New conversation ──
  const handleNewConversation = useCallback(async () => {
    clearMessages();
    const conv: Conversation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      personaId: currentPersonaId,
      title: "新对话",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addConversation(conv);
    setCurrentConversationId(conv.id);
  }, [currentPersonaId, clearMessages, addConversation, setCurrentConversationId]);

  // ── Select conversation ──
  const handleSelectConversation = useCallback(
    async (id: string) => {
      setCurrentConversationId(id);
      try {
        const msgs = await MessageStore.loadByConversation(id);
        console.log("[App] Loaded", msgs.length, "messages for conv", id.slice(0, 8));
        if (msgs.length > 0) {
          loadMessages(msgs);
        } else {
          clearMessages();
        }
      } catch (err) {
        console.error("[App] Failed to load messages:", err);
        clearMessages();
      }
    },
    [loadMessages, clearMessages, setCurrentConversationId]
  );

  // ── Rename conversation ──
  const handleRenameConversation = useCallback(
    (id: string, title: string) => {
      updateConversation(id, { title });
      // Also persist to DB immediately
      ConversationStore.updateTitle(id, title).catch((err) =>
        console.error("[App] Failed to rename conversation:", err)
      );
    },
    [updateConversation]
  );

  // ── Handle persona switch ──
  const handleSelectPersona = useCallback(
    (id: string) => {
      setCurrentPersonaId(id);
      clearMessages();
      setCurrentConversationId(null);
    },
    [setCurrentPersonaId, clearMessages, setCurrentConversationId]
  );

  // ── Send message ──
  const handleSend = useCallback(
    (content: string) => {
      let convId = currentConversationId;

      if (!convId) {
        // Create conversation — addConversation handles DB persistence
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const now = new Date().toISOString();
        convId = id;
        setCurrentConversationId(convId);

        const conv: Conversation = {
          id: convId,
          personaId: currentPersonaId,
          title: makeTitle(content),
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        addConversation(conv);
      }

      // Update title if first message
      if (messages.length === 0 && convId) {
        updateConversation(convId, { title: makeTitle(content) });
      }

      chatSend(content);
    },
    [
      currentConversationId,
      currentPersonaId,
      messages.length,
      chatSend,
      addConversation,
      updateConversation,
      setCurrentConversationId,
    ]
  );

  const handleToggleEditPersona = useCallback(() => {
    setShowPersonaEditor(!showPersonaEditor);
  }, [showPersonaEditor, setShowPersonaEditor]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#1a1a2e]">
      <Sidebar
        personas={personas}
        currentPersonaId={currentPersonaId}
        onSelectPersona={handleSelectPersona}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setShowSettings(true)}
        onTogglePersonaEditor={handleToggleEditPersona}
        theme={theme}
        onToggleTheme={toggleTheme}
        onCreatePersona={startCreatePersona}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onStop={stopGeneration}
          sendKey={config.sendKey}
          emptyText={currentPersona.greeting}
          personaName={currentPersona.name}
          personaAvatar={currentPersona.avatar}
        />
      </div>

      {isCreatingPersona && (
        <PersonaEditor
          mode="create"
          skills={skills}
          onCreate={(newPersona) => {
            addPersona(newPersona);
            cancelCreatePersona();
          }}
          onCancel={cancelCreatePersona}
          onClose={cancelCreatePersona}
        />
      )}

      {showPersonaEditor && !isCreatingPersona && (
        <PersonaEditor
          mode="edit"
          persona={currentPersona}
          skills={skills}
          onUpdate={updatePersona}
          onToggleSkill={toggleSkill}
          onDelete={deletePersona}
          onClose={() => setShowPersonaEditor(false)}
        />
      )}

      {showSettings && (
        <SettingsDialog
          config={config}
          onUpdate={updateConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ChatApp />
    </AppProvider>
  );
}

import type { Persona, Conversation } from "../types";
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Bot,
  PanelRightOpen,
  Sun,
  Moon,
  UserPlus,
} from "lucide-react";
import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface Props {
  personas: Persona[];
  currentPersonaId: string;
  onSelectPersona: (id: string) => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onOpenSettings: () => void;
  onTogglePersonaEditor: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onCreatePersona: () => void;
}

function EditableTitle({
  convId,
  title,
  isActive,
  isHovered,
  onSave,
}: {
  convId: string;
  title: string;
  isActive: boolean;
  isHovered: boolean;
  onSave: (id: string, newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(title);
      // Focus and select all after a tick
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, title]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) {
      onSave(convId, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't select conversation when double-clicking to edit
    setEditing(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 bg-transparent text-xs outline-none border-b border-[#3b82f6] py-0.5"
        style={{ color: isActive ? "#ffffff" : "#f1f5f9" }}
      />
    );
  }

  return (
    <span
      className="flex-1 truncate text-xs cursor-default"
      onDoubleClick={handleDoubleClick}
      title="双击编辑标题"
    >
      {title}
    </span>
  );
}

export function Sidebar({
  personas,
  currentPersonaId,
  onSelectPersona,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onTogglePersonaEditor,
  theme,
  onToggleTheme,
  onCreatePersona,
}: Props) {
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__create__") {
      if (selectRef.current) {
        selectRef.current.value = currentPersonaId;
      }
      onCreatePersona();
      return;
    }
    onSelectPersona(value);
  };

  return (
    <div className="w-[240px] h-full flex flex-col bg-[#16213e] border-r border-[#334155] select-none">
      {/* Persona selector */}
      <div className="p-3 border-b border-[#334155]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
            人格
          </span>
          <button
            onClick={onTogglePersonaEditor}
            className="p-1 rounded hover:bg-[#334155] text-[#64748b] transition-colors"
            title="编辑人格"
          >
            <PanelRightOpen size={14} />
          </button>
        </div>
        <select
          ref={selectRef}
          value={currentPersonaId}
          onChange={handleSelectChange}
          className="w-full rounded-lg border border-[#334155] bg-[#1a1a2e] text-[#f1f5f9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent cursor-pointer appearance-none"
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#1e293b] text-[#f1f5f9]">
              {p.avatar} {p.name}{p.isBuiltin ? "" : " *"}
            </option>
          ))}
          <option disabled className="bg-[#1e293b] text-[#64748b]">
            ──────────────
          </option>
          <option value="__create__" className="bg-[#1e293b] text-[#3b82f6] font-medium">
            + 创建新人格
          </option>
        </select>
      </div>

      {/* New conversation button */}
      <div className="p-3">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#334155] bg-transparent px-3 py-2.5 text-sm text-[#94a3b8] hover:bg-[#334155]/40 hover:border-solid hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          <Plus size={16} />
          新建对话
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider px-2 mb-2">
          会话历史
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs text-[#64748b] text-center py-6">
            暂无对话
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              const isHovered = conv.id === hoveredConvId;
              return (
                <div
                  key={conv.id}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition-all duration-150 ${
                    isActive
                      ? "bg-[#3b82f6] text-white shadow-md shadow-blue-500/20"
                      : "text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9]"
                  }`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <MessageSquare size={14} className="flex-shrink-0" />
                  <EditableTitle
                    convId={conv.id}
                    title={conv.title}
                    isActive={isActive}
                    isHovered={isHovered}
                    onSave={onRenameConversation}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className={`p-0.5 rounded transition-all duration-150 ${
                      isActive
                        ? "text-white/70 hover:text-red-300 hover:bg-red-500/20"
                        : isHovered
                          ? "opacity-100 text-[#64748b] hover:text-red-400 hover:bg-red-500/20"
                          : "opacity-0"
                    }`}
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="p-3 border-t border-[#334155] space-y-0.5">
        <button
          onClick={onCreatePersona}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          <UserPlus size={16} />
          创建新人格
        </button>
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </button>
        <button
          onClick={onTogglePersonaEditor}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          <Bot size={16} />
          人格管理
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          <Settings size={16} />
          设置
        </button>
      </div>
    </div>
  );
}

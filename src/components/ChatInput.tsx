import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Square, Paperclip } from "lucide-react";

interface Props {
  onSend: (content: string) => void;
  onStop: () => void;
  isLoading: boolean;
  sendKey: "enter" | "ctrl+enter";
}

export function ChatInput({ onSend, onStop, isLoading, sendKey }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isSendKey =
      sendKey === "ctrl+enter" ? e.ctrlKey && e.key === "Enter" : e.key === "Enter";

    if (isSendKey && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[#334155] bg-[#1a1a2e] p-4">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        {/* Attachment button (placeholder) */}
        <button
          className="flex-shrink-0 p-2.5 rounded-xl text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e293b] active:scale-95 transition-all duration-150"
          title="附件"
        >
          <Paperclip size={20} />
        </button>

        {/* Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="w-full resize-none rounded-2xl border border-[#334155] bg-[#1e293b] px-5 py-3 pr-4 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all duration-150"
            style={{ maxHeight: "200px" }}
          />
        </div>

        {/* Send / Stop button */}
        {isLoading ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:scale-90 transition-all duration-150 shadow-lg shadow-red-500/30"
            title="停止生成"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-shrink-0 p-2.5 rounded-xl bg-[#3b82f6] text-white hover:bg-[#2563eb] active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-150 shadow-lg shadow-blue-500/30"
            title={sendKey === "ctrl+enter" ? "发送 (Ctrl+Enter)" : "发送 (Enter)"}
          >
            <Send size={18} />
          </button>
        )}
      </div>

      {/* Hint */}
      <div className="text-center mt-2.5">
        <span className="text-[10px] text-[#64748b]">
          {sendKey === "ctrl+enter" ? "Ctrl+Enter 发送" : "Enter 发送"} · Shift+Enter 换行
        </span>
      </div>
    </div>
  );
}

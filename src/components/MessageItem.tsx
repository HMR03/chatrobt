import type { Message } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface Props {
  message: Message;
}

export function MessageItem({ message }: Props) {
  const [copied, setCopied] = useState(false);

  if (message.role === "system" || message.role === "tool") return null;

  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-5`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
          isUser
            ? "bg-[#3b82f6] text-white rounded-br-md shadow-blue-500/10"
            : "bg-[#1e293b] text-[#f1f5f9] rounded-bl-md border border-[#334155]/50"
        }`}
      >
        {/* Message header */}
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[11px] font-semibold ${isUser ? "text-blue-100" : "text-[#64748b]"}`}>
            {isUser ? "你" : "AI"}
          </span>
          {!isUser && message.content && !message.isStreaming && (
            <button
              onClick={handleCopy}
              className="opacity-40 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
              title="复制"
            >
              {copied ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="text-sm leading-relaxed">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <>
              <MarkdownRenderer content={message.content} />
              {message.isStreaming && (
                <span className="cursor-blink" />
              )}
            </>
          )}
        </div>

        {/* Tool calls indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#334155]">
            <div className="text-xs opacity-60">
              🔧 调用了工具: {message.toolCalls.map((tc) => tc.function.name).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

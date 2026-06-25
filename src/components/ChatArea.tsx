import { useRef, useEffect } from "react";
import type { Message } from "../types";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  sendKey: "enter" | "ctrl+enter";
  emptyText?: string;
  personaName?: string;
  personaAvatar?: string;
}

export function ChatArea({
  messages,
  isLoading,
  onSend,
  onStop,
  sendKey,
  emptyText,
  personaName,
  personaAvatar,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Header */}
      {personaName && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#334155] bg-[#1a1a2e]/80 backdrop-blur-sm">
          <span className="text-lg">{personaAvatar}</span>
          <span className="text-sm font-semibold text-[#f1f5f9]">{personaName}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-5">💬</div>
              <h2 className="text-xl font-semibold text-[#f1f5f9] mb-3">
                开始对话
              </h2>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                {emptyText || "输入你的问题，AI 会为你解答"}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isLoading={isLoading}
        sendKey={sendKey}
      />
    </div>
  );
}

import { useState, useCallback, useRef } from "react";
import { streamChatCompletion } from "../services/deepseek";
import {
  buildSystemPrompt,
  collectToolSchemas,
  SKILL_EXECUTORS,
} from "../services/persona";
import { extractMemories, deduplicateMemories } from "../services/memory";
import type {
  Message,
  Persona,
  Skill,
  Memory,
  Conversation,
} from "../types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface UseChatOptions {
  apiKey: string;
  persona: Persona;
  skills: Skill[];
  memories: Memory[];
  onMemoriesExtracted?: (memories: Omit<Memory, "id" | "createdAt">[]) => void;
  onConversationUpdate?: (conversation: Conversation) => void;
}

export function useChat(options: UseChatOptions) {
  const { apiKey, persona, skills, memories, onMemoriesExtracted } =
    options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messageCountRef = useRef(0);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !apiKey || isLoading) return;

      // 添加用户消息
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);
      messageCountRef.current += 1;

      try {
        // 构建完整的消息列表
        const systemPrompt = buildSystemPrompt(
          persona,
          skills,
          memories.map((m) => m.content)
        );

        const allMessages: Message[] = [
          {
            id: "system",
            role: "system",
            content: systemPrompt,
            timestamp: 0,
          },
          ...messages,
          userMsg,
        ];

        const toolSchemas = collectToolSchemas(skills);

        // 流式调用
        let fullContent = "";
        const stream = streamChatCompletion({
          apiKey,
          model: persona.model,
          messages: allMessages,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          topP: persona.topP,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        });

        for await (const chunk of stream) {
          if (chunk.type === "content") {
            fullContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          } else if (chunk.type === "tool_calls") {
            // 处理工具调用
            // We need to capture current messages for tool call handling
            const currentMessages = [...messages, userMsg];
            await handleToolCalls(
              chunk.toolCalls,
              currentMessages,
              assistantMsg,
              fullContent,
              systemPrompt,
              toolSchemas,
              persona
            );
            return; // handleToolCalls 内部会更新状态
          } else if (chunk.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      content: `❌ ${chunk.error}`,
                      isStreaming: false,
                    }
                  : m
              )
            );
            return;
          }
        }

        // 流结束
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
          )
        );

        // 每 10 轮对话提取一次记忆
        if (
          persona.memoryEnabled &&
          messageCountRef.current % 10 === 0
        ) {
          triggerMemoryExtraction();
        }
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: `❌ 请求失败: ${err.message}`,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, persona, skills, memories, messages, isLoading]
  );

  // 处理 Function Calling
  const handleToolCalls = async (
    toolCalls: any[],
    prevMessages: Message[],
    assistantMsg: Message,
    assistantContent: string,
    systemPrompt: string,
    toolSchemas: any[],
    personaRef: Persona
  ) => {
    // 记录助手的工具调用消息
    const assistantWithTools: Message = {
      ...assistantMsg,
      content: assistantContent,
      toolCalls,
      isStreaming: false,
    };

    // 执行每个工具调用
    const toolResults: Message[] = toolCalls.map((tc) => {
      const executor = SKILL_EXECUTORS[tc.function.name];
      let result: string;
      if (executor) {
        try {
          const args = tc.function.arguments
            ? JSON.parse(tc.function.arguments)
            : {};
          result = executor(args);
        } catch (e: any) {
          result = JSON.stringify({ error: e.message });
        }
      } else {
        result = JSON.stringify({
          error: `Unknown function: ${tc.function.name}`,
        });
      }

      return {
        id: generateId(),
        role: "tool" as const,
        content: result,
        toolCallId: tc.id,
        timestamp: Date.now(),
      };
    });

    // 把工具结果发回给模型，获取最终回复
    const followUpMessages: Message[] = [
      {
        id: "system",
        role: "system",
        content: systemPrompt,
        timestamp: 0,
      },
      ...prevMessages,
      assistantWithTools,
      ...toolResults,
    ];

    const finalMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [
      ...prev.map((m) =>
        m.id === assistantMsg.id ? assistantWithTools : m
      ),
      ...toolResults,
      finalMsg,
    ]);

    let finalContent = "";
    const finalStream = streamChatCompletion({
      apiKey,
      model: personaRef.model,
      messages: followUpMessages,
      temperature: personaRef.temperature,
      maxTokens: personaRef.maxTokens,
    });

    for await (const chunk of finalStream) {
      if (chunk.type === "content") {
        finalContent += chunk.content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalMsg.id ? { ...m, content: finalContent } : m
          )
        );
      } else if (chunk.type === "error") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalMsg.id
              ? { ...m, content: `❌ ${chunk.error}`, isStreaming: false }
              : m
          )
        );
        setIsLoading(false);
        return;
      }
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === finalMsg.id ? { ...m, isStreaming: false } : m
      )
    );
    setIsLoading(false);
  };

  // 记忆提取
  const triggerMemoryExtraction = async () => {
    if (!onMemoriesExtracted) return;
    const allMsgs = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    );
    const extracted = await extractMemories(apiKey, allMsgs, persona.id);
    const deduplicated = deduplicateMemories(extracted, memories);
    if (deduplicated.length > 0) {
      onMemoriesExtracted(deduplicated);
    }
  };

  // 停止生成
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  // 清空对话
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageCountRef.current = 0;
  }, []);

  // 加载历史对话
  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
    messageCountRef.current = msgs.filter((m) => m.role === "user").length;
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
    setMessages,
  };
}

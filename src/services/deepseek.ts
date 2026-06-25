import type { Message, ModelName, ToolCall } from "../types";

const BASE_URL = "https://api.deepseek.com";

// ---------- 请求构建 ----------

interface ChatRequestOptions {
  apiKey: string;
  model: ModelName;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tools?: any[];
  stream?: boolean;
}

function buildRequestBody(options: ChatRequestOptions) {
  const body: Record<string, any> = {
    model: options.model,
    messages: options.messages.map((m) => {
      const msg: Record<string, any> = {
        role: m.role,
        content: m.content,
      };
      if (m.role === "tool" && m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      if (m.role === "assistant" && m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls;
      }
      return msg;
    }),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    top_p: options.topP ?? 1.0,
    stream: options.stream ?? false,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  return body;
}

// ---------- 非流式调用 ----------

export async function chatCompletion(
  options: ChatRequestOptions
): Promise<{
  content: string;
  toolCalls?: ToolCall[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody({ ...options, stream: false })),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `DeepSeek API Error ${response.status}: ${error?.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const choice = data.choices[0];

  return {
    content: choice.message.content || "",
    toolCalls: choice.message.tool_calls,
    usage: data.usage,
  };
}

// ---------- 流式调用（核心） ----------

export async function* streamChatCompletion(
  options: ChatRequestOptions
): AsyncGenerator<
  | { type: "content"; content: string }
  | { type: "tool_calls"; toolCalls: ToolCall[] }
  | { type: "done"; usage?: any }
  | { type: "error"; error: string }
> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(buildRequestBody({ ...options, stream: true })),
    });
  } catch (err: any) {
    yield {
      type: "error",
      error: `Network error: ${err.message}`,
    };
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    yield {
      type: "error",
      error: `API Error ${response.status}: ${error?.error?.message || response.statusText}`,
    };
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallsAccumulator: Record<number, ToolCall> = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          // 如果有累积的 tool_calls，在结束时一次性输出
          const accumulated = Object.values(toolCallsAccumulator);
          if (accumulated.length > 0) {
            yield { type: "tool_calls", toolCalls: accumulated };
          }
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // 文本内容
          if (delta.content) {
            yield { type: "content", content: delta.content };
          }

          // 工具调用（流式累积）
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsAccumulator[idx]) {
                toolCallsAccumulator[idx] = {
                  id: tc.id || "",
                  type: "function",
                  function: { name: "", arguments: "" },
                };
              }
              if (tc.id) toolCallsAccumulator[idx].id = tc.id;
              if (tc.function?.name)
                toolCallsAccumulator[idx].function.name += tc.function.name;
              if (tc.function?.arguments)
                toolCallsAccumulator[idx].function.arguments +=
                  tc.function.arguments;
            }
          }
        } catch {
          // 解析失败的行跳过
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------- Token 估算（用于 UI 显示） ----------

export function estimateTokens(text: string): number {
  // 粗略估算：中文约 1 字 = 1.5 token，英文约 1 词 = 1.3 token
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.4);
}

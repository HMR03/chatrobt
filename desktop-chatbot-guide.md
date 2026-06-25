# 桌面 AI 聊天机器人 — 完整开发指南

## 一、给 Claude Code 的启动提示词

> 把下面这段直接粘贴到 Claude Code 里，它会帮你从零搭建整个项目。

```
帮我创建一个桌面 AI 聊天机器人项目，技术栈：Tauri 2.x + React + TypeScript + Tailwind CSS。

## 项目要求

1. 用 `npm create tauri-app@latest` 初始化，选 React + TypeScript 模板
2. 安装以下依赖：
   - 前端: react-markdown, remark-gfm, react-syntax-highlighter, @tauri-apps/plugin-store, @tauri-apps/plugin-sql, @tauri-apps/plugin-autostart, @tauri-apps/plugin-global-shortcut, lucide-react, tailwindcss
   - Tauri 插件（在 src-tauri/Cargo.toml 里加）: tauri-plugin-store, tauri-plugin-sql (features=["sqlite"]), tauri-plugin-autostart, tauri-plugin-global-shortcut

3. 核心功能：
   - 接入 DeepSeek V4 API（OpenAI 兼容格式），base_url = https://api.deepseek.com，模型用 deepseek-v4-flash
   - 支持流式输出（SSE），打字机效果显示回复
   - 多人格系统：每个人格有独立的 system prompt、temperature、greeting、skills 配置
   - 人格配置以 JSON 文件存储在 appDataDir/personas/ 下
   - Skill 技能系统：支持 prompt_injection 型（追加 system prompt）和 function_call 型（DeepSeek Tool Use）
   - 聊天记录用 SQLite 持久化存储
   - 简单的记忆系统：对话结束时用 DeepSeek 提取关键信息，下次对话注入 system prompt
   - API Key 用 @tauri-apps/plugin-store 加密存储
   - 系统托盘 + 全局快捷键 Alt+Space 呼出窗口

4. UI 布局（三栏式）：
   - 左栏 240px：顶部人格切换，中间会话列表，底部设置按钮
   - 中间主区域：聊天消息流（Markdown 渲染 + 代码高亮），底部输入框
   - 右栏可折叠 280px：人格编辑面板（修改 prompt、调 temperature、开关技能）
   - 深色/浅色主题切换
   - 消息气泡区分用户和 AI，AI 消息支持 Markdown 渲染

5. 内置 3 个默认人格：
   - 通用助手（temperature 0.7）
   - 创意写作伙伴（temperature 1.2）
   - 编程导师（temperature 0.3）

6. 内置 3 个默认技能：
   - 当前时间（function_call 型）
   - 翻译助手（prompt_injection 型）
   - 网页摘要（prompt_injection 型）

请按以下顺序执行：
Step 1: 初始化项目并安装所有依赖
Step 2: 创建类型定义文件 src/types/index.ts
Step 3: 创建 DeepSeek API 服务 src/services/deepseek.ts
Step 4: 创建人格管理服务 src/services/persona.ts
Step 5: 创建存储服务 src/services/storage.ts
Step 6: 创建记忆服务 src/services/memory.ts
Step 7: 创建所有 React 组件
Step 8: 组装 App.tsx，配置路由和全局状态
Step 9: 配置 Tauri（tauri.conf.json 权限、系统托盘、窗口设置）
Step 10: 编译运行，确认没有报错

下面是核心文件的参考实现，请基于这些来构建完整项目：
```

---

## 二、核心源码参考

### 2.1 类型定义 — `src/types/index.ts`

```typescript
// ============ 消息 ============
export interface Message {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  isStreaming?: boolean;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ============ 人格 ============
export interface Persona {
  id: string;
  name: string;
  avatar: string;          // emoji 或图片路径
  description: string;
  systemPrompt: string;
  greeting: string;        // 新对话的开场白
  model: ModelName;
  temperature: number;
  maxTokens: number;
  topP: number;
  skills: string[];        // 挂载的 Skill ID 列表
  memoryEnabled: boolean;
  isBuiltin: boolean;      // 内置人格不可删除
  createdAt: string;
  updatedAt: string;
}

export type ModelName = "deepseek-v4-flash" | "deepseek-v4-pro";

// ============ 技能 ============
export interface Skill {
  id: string;
  name: string;
  description: string;     // 给用户看的描述
  type: "function_call" | "prompt_injection";
  enabled: boolean;
  // function_call 型
  toolSchema?: {
    type: "function";
    function: {
      name: string;
      description: string;     // 给模型看的描述
      parameters: Record<string, any>;
      strict?: boolean;
    };
  };
  executor?: string;          // 执行器函数名
  // prompt_injection 型
  promptAddition?: string;
}

// ============ 会话 ============
export interface Conversation {
  id: string;
  personaId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ============ 记忆 ============
export interface Memory {
  id: string;
  personaId: string;
  content: string;
  category: "fact" | "preference" | "topic";
  createdAt: string;
}

// ============ 应用配置 ============
export interface AppConfig {
  apiKey: string;
  defaultModel: ModelName;
  theme: "light" | "dark" | "system";
  sendKey: "enter" | "ctrl+enter";
  language: "zh" | "en";
  globalShortcut: string;
}
```

### 2.2 DeepSeek API 服务 — `src/services/deepseek.ts`

```typescript
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
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(buildRequestBody({ ...options, stream: true })),
  });

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
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.4);
}
```

### 2.3 人格管理 — `src/services/persona.ts`

```typescript
import type { Persona, Skill } from "../types";

// ---------- 内置人格 ----------

export const BUILTIN_PERSONAS: Persona[] = [
  {
    id: "assistant",
    name: "通用助手",
    avatar: "🤖",
    description: "聪明、准确、有条理的全能助手",
    systemPrompt: `你是一个聪明、友善的AI助手。你的特点：
- 回答准确且有条理，善于用清晰的结构组织信息
- 遇到不确定的问题会诚实说明，不会编造答案
- 会根据用户的技术水平调整解释的深度
- 支持中英文双语交流，默认使用用户的语言
- 代码回答时提供完整可运行的示例`,
    greeting: "你好！我是你的AI助手，有什么可以帮你的吗？",
    model: "deepseek-v4-flash",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
    skills: ["current-time", "translator"],
    memoryEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "writer",
    name: "创意写作",
    avatar: "✍️",
    description: "文学性强、想象力丰富的写作伙伴",
    systemPrompt: `你是一位才华横溢的创意写作伙伴。你的特点：
- 文字优美，善于使用比喻、意象和修辞手法
- 能够驾驭多种文学风格：诗歌、散文、小说、戏剧、科幻、奇幻
- 会提供多个创意方向供用户选择
- 能根据用户的风格偏好调整输出
- 鼓励用户的创作，给出建设性的反馈
- 熟悉中西方文学传统，能灵活运用典故和文化元素`,
    greeting:
      "灵感的种子已经播下，让我们一起浇灌它吧。你想创作什么？",
    model: "deepseek-v4-flash",
    temperature: 1.2,
    maxTokens: 8192,
    topP: 0.95,
    skills: [],
    memoryEnabled: false,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "coder",
    name: "编程导师",
    avatar: "💻",
    description: "耐心细致的编程老师，循序渐进",
    systemPrompt: `你是一位经验丰富的编程导师。你的教学风格：
- 循序渐进，从简单到复杂，确保每一步都理解了再继续
- 先给出简洁的答案/代码，然后逐步解释为什么这样写
- 代码示例总是完整可运行的，包含必要的导入和注释
- 会主动指出常见的坑和最佳实践
- 鼓励学生思考，会反问 "你觉得这里为什么要这样做？"
- 擅长的领域：Python, JavaScript/TypeScript, Rust, Go, SQL, 系统设计
- 回答时使用中文解释 + 英文代码和注释的混合模式`,
    greeting:
      "准备好开始编程了吗？告诉我你想学什么，或者把你遇到的问题发给我。",
    model: "deepseek-v4-flash",
    temperature: 0.3,
    maxTokens: 4096,
    topP: 1.0,
    skills: ["current-time"],
    memoryEnabled: true,
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ---------- 内置技能 ----------

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "current-time",
    name: "当前时间",
    description: "获取用户当前的日期和时间",
    type: "function_call",
    enabled: true,
    toolSchema: {
      type: "function",
      function: {
        name: "get_current_time",
        description:
          "获取用户当前的日期、时间和星期。当用户询问现在几点、今天几号、今天星期几时调用此工具。",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    executor: "get_current_time",
  },
  {
    id: "translator",
    name: "翻译助手",
    description: "增强翻译能力，自动识别语言并提供地道翻译",
    type: "prompt_injection",
    enabled: true,
    promptAddition: `当用户要求翻译时，请遵循以下规则：
- 自动识别源语言，翻译为目标语言
- 如果用户没有指定目标语言，中文翻译为英文，其他语言翻译为中文
- 提供直译和意译两个版本
- 标注关键词汇的用法说明
- 对于习语、俗语，额外解释其文化背景`,
  },
  {
    id: "summarizer",
    name: "网页/文章摘要",
    description: "增强长文本摘要和提炼能力",
    type: "prompt_injection",
    enabled: true,
    promptAddition: `当用户发送大段文字或要求摘要时，请遵循以下规则：
- 先给出一句话核心摘要
- 然后分 3-5 个要点展开
- 最后给出你的评价或延伸思考
- 如果是技术文章，提炼出关键结论和可操作的建议`,
  },
];

// ---------- 技能执行器 ----------

export const SKILL_EXECUTORS: Record<string, (...args: any[]) => string> = {
  get_current_time: () => {
    const now = new Date();
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return JSON.stringify({
      date: now.toLocaleDateString("zh-CN"),
      time: now.toLocaleTimeString("zh-CN"),
      weekday: `星期${days[now.getDay()]}`,
      timestamp: now.toISOString(),
    });
  },
};

// ---------- 构建完整 system prompt ----------

export function buildSystemPrompt(
  persona: Persona,
  skills: Skill[],
  memories: string[]
): string {
  let prompt = persona.systemPrompt;

  // 注入 prompt_injection 型技能
  const injections = skills
    .filter((s) => s.type === "prompt_injection" && s.enabled)
    .map((s) => s.promptAddition)
    .filter(Boolean);

  if (injections.length > 0) {
    prompt += "\n\n## 额外能力\n" + injections.join("\n\n");
  }

  // 注入记忆
  if (memories.length > 0) {
    prompt += "\n\n## 你对当前用户的了解\n";
    prompt += memories.map((m) => `- ${m}`).join("\n");
    prompt +=
      "\n\n（以上信息来自之前的对话，请自然地运用这些了解，不要刻意提及"我记得"之类的话。）";
  }

  return prompt;
}

// ---------- 收集 function_call 型工具定义 ----------

export function collectToolSchemas(skills: Skill[]) {
  return skills
    .filter((s) => s.type === "function_call" && s.enabled && s.toolSchema)
    .map((s) => s.toolSchema!);
}
```

### 2.4 记忆系统 — `src/services/memory.ts`

```typescript
import { chatCompletion } from "./deepseek";
import type { Message, Memory } from "../types";

// 从一段对话中提取值得记住的信息
export async function extractMemories(
  apiKey: string,
  messages: Message[],
  personaId: string
): Promise<Omit<Memory, "id" | "createdAt">[]> {
  // 只取最近 20 条消息，避免 token 浪费
  const recent = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20);

  if (recent.length < 4) return []; // 对话太短，不提取

  const result = await chatCompletion({
    apiKey,
    model: "deepseek-v4-flash",
    temperature: 0.1,
    maxTokens: 1024,
    messages: [
      {
        id: "sys",
        role: "system",
        content: `你是一个信息提取助手。从对话中提取值得长期记住的信息。
只提取明确陈述的事实，不要推测。
返回纯 JSON 数组，每个元素格式：{"content": "信息内容", "category": "fact|preference|topic"}

category 说明：
- fact: 用户的个人信息（名字、职业、所在城市、家庭情况等）
- preference: 用户的偏好（喜欢的语言、技术栈、写作风格等）
- topic: 用户关注的话题（正在做的项目、学习的内容等）

如果没有值得记住的信息，返回空数组 []。
只返回 JSON，不要任何其他文字。`,
        timestamp: Date.now(),
      },
      {
        id: "user",
        role: "user",
        content: recent
          .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
          .join("\n"),
        timestamp: Date.now(),
      },
    ],
  });

  try {
    const cleaned = result.content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(
      (item: { content: string; category: string }) => ({
        personaId,
        content: item.content,
        category: item.category as Memory["category"],
      })
    );
  } catch {
    return [];
  }
}

// 去重：跟已有记忆比较，只保留新信息
export function deduplicateMemories(
  newMemories: Omit<Memory, "id" | "createdAt">[],
  existingMemories: Memory[]
): Omit<Memory, "id" | "createdAt">[] {
  return newMemories.filter((nm) => {
    return !existingMemories.some((em) => {
      // 简单的字符串相似度检查
      const a = nm.content.toLowerCase();
      const b = em.content.toLowerCase();
      return a === b || a.includes(b) || b.includes(a);
    });
  });
}
```

### 2.5 聊天控制器（核心状态管理） — `src/hooks/useChat.ts`

```typescript
import { useState, useCallback, useRef } from "react";
import { streamChatCompletion, chatCompletion } from "../services/deepseek";
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
            await handleToolCalls(
              chunk.toolCalls,
              allMessages,
              assistantMsg,
              fullContent,
              systemPrompt,
              toolSchemas
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
    toolSchemas: any[]
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
      finalMsg,
    ]);

    let finalContent = "";
    const finalStream = streamChatCompletion({
      apiKey,
      model: persona.model,
      messages: followUpMessages,
      temperature: persona.temperature,
      maxTokens: persona.maxTokens,
    });

    for await (const chunk of finalStream) {
      if (chunk.type === "content") {
        finalContent += chunk.content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalMsg.id ? { ...m, content: finalContent } : m
          )
        );
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
  };
}
```

### 2.6 SQLite 存储服务 — `src/services/storage.ts`

```typescript
// 这个文件需要 @tauri-apps/plugin-sql
// Claude Code 在搭建项目时会安装
// 这里给出接口定义和核心逻辑

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

// 初始化时执行：
// import Database from '@tauri-apps/plugin-sql';
// const db = await Database.load('sqlite:chatbot.db');
// await db.execute(INIT_SQL);

// ---------- 会话操作 ----------

export const ConversationStore = {
  // 创建新会话
  async create(db: any, personaId: string): Promise<string> {
    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO conversations (id, persona_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, personaId, "新对话", now, now]
    );
    return id;
  },

  // 更新标题（用第一条用户消息的前 20 字）
  async updateTitle(db: any, id: string, title: string) {
    await db.execute(
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
      [title.slice(0, 30), new Date().toISOString(), id]
    );
  },

  // 获取某个人格的所有会话
  async listByPersona(db: any, personaId: string): Promise<Conversation[]> {
    return db.select(
      "SELECT * FROM conversations WHERE persona_id = ? ORDER BY updated_at DESC",
      [personaId]
    );
  },

  // 删除会话（消息会级联删除）
  async delete(db: any, id: string) {
    await db.execute("DELETE FROM conversations WHERE id = ?", [id]);
  },
};

// ---------- 消息操作 ----------

export const MessageStore = {
  async save(db: any, conversationId: string, message: Message) {
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

  async loadByConversation(db: any, conversationId: string): Promise<Message[]> {
    const rows = await db.select(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
      [conversationId]
    );
    return rows.map((row: any) => ({
      ...row,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolCallId: row.tool_call_id,
    }));
  },
};

// ---------- 记忆操作 ----------

export const MemoryStore = {
  async save(
    db: any,
    memory: Omit<Memory, "id" | "createdAt">
  ): Promise<string> {
    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    await db.execute(
      "INSERT INTO memories (id, persona_id, content, category, created_at) VALUES (?, ?, ?, ?, ?)",
      [
        id,
        memory.personaId,
        memory.content,
        memory.category,
        new Date().toISOString(),
      ]
    );
    return id;
  },

  async loadByPersona(db: any, personaId: string): Promise<Memory[]> {
    return db.select(
      "SELECT * FROM memories WHERE persona_id = ? ORDER BY created_at DESC LIMIT 50",
      [personaId]
    );
  },

  async delete(db: any, id: string) {
    await db.execute("DELETE FROM memories WHERE id = ?", [id]);
  },

  async clearByPersona(db: any, personaId: string) {
    await db.execute("DELETE FROM memories WHERE persona_id = ?", [
      personaId,
    ]);
  },
};
```

---

## 三、Tauri 配置要点

把以下内容也一起粘给 Claude Code 作为参考：

```
## Tauri 配置注意事项（tauri.conf.json / capabilities）

1. 窗口配置：
   - 默认尺寸 1100x750，最小尺寸 800x600
   - 标题 "AI Chat"
   - decorations: true（用系统标题栏，简单可靠）
   - 支持 resize

2. 权限/Capabilities：
   - 需要开启的权限：
     - core:default（基础）
     - sql:default（SQLite 数据库）
     - store:default（安全存储）
     - autostart:default（开机自启）
     - global-shortcut:default（全局快捷键）
   - 安全策略：只允许连接 api.deepseek.com

3. 系统托盘：
   - 关闭窗口时隐藏到托盘而不是退出
   - 托盘菜单：显示窗口 / 退出

4. 全局快捷键：
   - Alt+Space 切换窗口显示/隐藏
```

---

## 四、操作步骤总结

```
1. 打开 VS Code，确保已安装 Claude Code 扩展
2. 确保系统已安装：Node.js 18+, Rust (rustup), 系统 WebView2
3. 打开一个空目录作为项目根目录
4. 把上面"给 Claude Code 的启动提示词"完整粘贴进去
5. 等它跑完初始化（大约 2-3 分钟）
6. 如果有报错，直接告诉 Claude Code "修复这个错误"
7. 运行 npm run tauri dev 查看效果
8. 在设置界面输入你的 DeepSeek API key (sk-130d9...95d4)
9. 开始聊天测试
```

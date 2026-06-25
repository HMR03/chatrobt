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

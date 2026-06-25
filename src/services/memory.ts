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

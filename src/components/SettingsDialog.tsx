import type { AppConfig, ModelName } from "../types";
import { X, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface Props {
  config: AppConfig;
  onUpdate: (partial: Partial<AppConfig>) => void;
  onClose: () => void;
}

export function SettingsDialog({ config, onUpdate, onClose }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState(config.apiKey);

  const handleSaveKey = () => {
    onUpdate({ apiKey });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[480px] max-h-[80vh] overflow-y-auto rounded-2xl bg-[#1e293b] shadow-2xl border border-[#334155] mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#334155]">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">设置</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#334155] text-[#64748b] hover:text-[#f1f5f9] active:scale-90 transition-all duration-150"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold text-[#f1f5f9] mb-2">
              DeepSeek API Key
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-[#334155] bg-[#1a1a2e] px-4 py-2.5 pr-10 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all duration-150"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#f1f5f9] transition-colors p-1"
                  title={showKey ? "隐藏" : "显示"}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                className="px-5 py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-medium hover:bg-[#2563eb] active:scale-95 transition-all duration-150 shadow-lg shadow-blue-500/20 whitespace-nowrap"
              >
                保存
              </button>
            </div>
            <p className="text-[10px] text-[#64748b] mt-2">
              API Key 将安全存储在本地的加密存储中，不会上传到任何第三方服务器
            </p>
          </div>

          {/* Default Model */}
          <div>
            <label className="block text-sm font-semibold text-[#f1f5f9] mb-2">
              默认模型
            </label>
            <select
              value={config.defaultModel}
              onChange={(e) => onUpdate({ defaultModel: e.target.value as ModelName })}
              className="w-full rounded-xl border border-[#334155] bg-[#1a1a2e] text-[#f1f5f9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent cursor-pointer appearance-none transition-all duration-150"
            >
              <option value="deepseek-v4-flash" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Flash（快速）</option>
              <option value="deepseek-v4-pro" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Pro（高质量）</option>
            </select>
          </div>

          {/* Send Key */}
          <div>
            <label className="block text-sm font-semibold text-[#f1f5f9] mb-2">
              发送快捷键
            </label>
            <div className="flex gap-2">
              {(["enter", "ctrl+enter"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => onUpdate({ sendKey: key })}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                    config.sendKey === key
                      ? "border-[#3b82f6] bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                      : "border-[#334155] bg-[#1a1a2e] text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9]"
                  }`}
                >
                  {key === "enter" ? "Enter" : "Ctrl + Enter"}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-[#f1f5f9] mb-2">
              界面语言
            </label>
            <select
              value={config.language}
              onChange={(e) => onUpdate({ language: e.target.value as "zh" | "en" })}
              className="w-full rounded-xl border border-[#334155] bg-[#1a1a2e] text-[#f1f5f9] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent cursor-pointer appearance-none transition-all duration-150"
            >
              <option value="zh" className="bg-[#1e293b] text-[#f1f5f9]">中文</option>
              <option value="en" className="bg-[#1e293b] text-[#f1f5f9]">English</option>
            </select>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-semibold text-[#f1f5f9] mb-2">
              主题
            </label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdate({ theme: t })}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                    config.theme === t
                      ? "border-[#3b82f6] bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                      : "border-[#334155] bg-[#1a1a2e] text-[#94a3b8] hover:bg-[#334155]/50 hover:text-[#f1f5f9]"
                  }`}
                >
                  {t === "light" ? "☀️ 浅色" : t === "dark" ? "🌙 深色" : "💻 跟随系统"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

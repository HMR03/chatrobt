import type { Persona, Skill, ModelName } from "../types";
import { X, Trash2, Check } from "lucide-react";
import { useState } from "react";

// Quick-emoji palette
const EMOJI_LIST = ["🐱","👩‍🏫","🎭","🧙","💼","🎨","🤓","😈","🦊","👻","🤡","🎅","🤖","✍️","💻","🧠","🐉","🦄","👽","🎯"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ======== Create mode props ========
interface CreateProps {
  mode: "create";
  skills: Skill[];
  onCreate: (persona: Persona) => void;
  onCancel: () => void;
  onClose: () => void;
}

// ======== Edit mode props ========
interface EditProps {
  mode: "edit";
  persona: Persona;
  skills: Skill[];
  onUpdate: (id: string, partial: Partial<Persona>) => void;
  onToggleSkill: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type Props = CreateProps | EditProps;

export function PersonaEditor(props: Props) {
  // ── Edit mode ──
  if (props.mode === "edit") {
    return <EditPersonaEditor {...props} />;
  }
  // ── Create mode ──
  return <CreatePersonaEditor {...props} />;
}

// ======================== EDIT MODE ========================

function EditPersonaEditor({ persona, skills, onUpdate, onToggleSkill, onDelete, onClose }: EditProps) {
  const [name, setName] = useState(persona.name);
  const [systemPrompt, setSystemPrompt] = useState(persona.systemPrompt);
  const [temperature, setTemperature] = useState(persona.temperature);
  const [maxTokens, setMaxTokens] = useState(persona.maxTokens);
  const [topP, setTopP] = useState(persona.topP);
  const [model, setModel] = useState<ModelName>(persona.model);
  const [memoryEnabled, setMemoryEnabled] = useState(persona.memoryEnabled);
  const [greeting, setGreeting] = useState(persona.greeting);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdate(persona.id, {
      name,
      systemPrompt,
      temperature,
      maxTokens,
      topP,
      model,
      memoryEnabled,
      greeting,
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(persona.id);
    onClose();
  };

  const personaSkills = skills.filter((s) => persona.skills.includes(s.id));

  return (
    <div className="w-[280px] h-full flex flex-col bg-[#16213e] border-l border-[#334155]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9]">
          {persona.avatar} {persona.name}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#334155] text-[#64748b] hover:text-[#f1f5f9] active:scale-90 transition-all duration-150"
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="名称">
          <Input value={name} onChange={setName} onBlur={handleSave} />
        </Field>

        <Field label="开场白">
          <Input value={greeting} onChange={setGreeting} onBlur={handleSave} />
        </Field>

        <Field label="模型">
          <Select value={model} onChange={(v) => { setModel(v as ModelName); onUpdate(persona.id, { model: v as ModelName }); }}>
            <option value="deepseek-v4-flash" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Flash</option>
            <option value="deepseek-v4-pro" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Pro</option>
          </Select>
        </Field>

        <SliderField label="温度" value={temperature} min={0} max={2} step={0.05}
          onChange={(v) => { setTemperature(v); onUpdate(persona.id, { temperature: v }); }}
          left="精确" right="创意" />

        <SliderField label="最大 Token" value={maxTokens} min={512} max={32768} step={512}
          onChange={(v) => { setMaxTokens(v); onUpdate(persona.id, { maxTokens: v }); }}
          displayValue={String(maxTokens)} />

        <SliderField label="Top P" value={topP} min={0} max={1} step={0.05}
          onChange={(v) => { setTopP(v); onUpdate(persona.id, { topP: v }); }} />

        <ToggleField label="记忆系统" enabled={memoryEnabled}
          onChange={(v) => { setMemoryEnabled(v); onUpdate(persona.id, { memoryEnabled: v }); }} />

        {/* Skills */}
        <div>
          <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
            挂载的技能
          </label>
          <div className="space-y-1.5">
            {personaSkills.map((skill) => (
              <SkillToggleRow key={skill.id} skill={skill} onToggle={() => onToggleSkill(skill.id)} />
            ))}
            {personaSkills.length === 0 && (
              <p className="text-xs text-[#64748b] text-center py-3">暂无挂载技能</p>
            )}
          </div>
        </div>

        {/* System Prompt */}
        <Field label="System Prompt">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            onBlur={handleSave}
            rows={8}
            className="w-full rounded-lg border border-[#334155] bg-[#1a1a2e] px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent resize-none font-mono leading-relaxed transition-all duration-150"
          />
        </Field>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#334155] space-y-2">
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2563eb] active:scale-[0.98] transition-all duration-150 shadow-lg shadow-blue-500/20"
        >
          保存修改
        </button>
        {!persona.isBuiltin && (
          <button
            onClick={handleDelete}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
              confirmDelete
                ? "bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700"
                : "border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60"
            }`}
          >
            {confirmDelete ? (
              <span className="flex items-center justify-center gap-1.5">
                <Check size={15} /> 确认删除
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Trash2 size={15} /> 删除此人格
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ======================== CREATE MODE ========================

function CreatePersonaEditor({ skills, onCreate, onCancel, onClose }: CreateProps) {
  const [avatar, setAvatar] = useState("🤖");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [greeting, setGreeting] = useState("你好！有什么可以帮你的？");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState<ModelName>("deepseek-v4-flash");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [topP, setTopP] = useState(1.0);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const handleCreate = () => {
    if (!name.trim()) return;
    if (!systemPrompt.trim()) return;

    const now = new Date().toISOString();
    const persona: Persona = {
      id: generateId(),
      name: name.trim(),
      avatar,
      description: description.trim() || `${name.trim()} — 自定义人格`,
      systemPrompt: systemPrompt.trim(),
      greeting: greeting.trim() || "你好！有什么可以帮你的？",
      model,
      temperature,
      maxTokens,
      topP,
      skills: selectedSkills,
      memoryEnabled,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };
    onCreate(persona);
  };

  const toggleSkillSelect = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const isValid = name.trim() && systemPrompt.trim();

  return (
    <div className="w-[280px] h-full flex flex-col bg-[#16213e] border-l border-[#334155]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#334155]">
        <h3 className="text-sm font-semibold text-[#f1f5f9]">
          ✨ 创建新人格
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#334155] text-[#64748b] hover:text-[#f1f5f9] active:scale-90 transition-all duration-150"
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Emoji picker */}
        <div>
          <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
            头像
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={`text-xl p-1.5 rounded-lg transition-all duration-150 ${
                  avatar === emoji
                    ? "bg-[#3b82f6] scale-110 shadow-md shadow-blue-500/30"
                    : "hover:bg-[#334155] hover:scale-105"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-center">
            <span className="text-3xl">{avatar}</span>
          </div>
        </div>

        <Field label="名称 *">
          <Input value={name} onChange={setName} placeholder="例如：法律顾问" />
        </Field>

        <Field label="描述">
          <Input value={description} onChange={setDescription} placeholder="一句话简介" />
        </Field>

        <Field label="开场白">
          <Input value={greeting} onChange={setGreeting} />
        </Field>

        <Field label="模型">
          <Select value={model} onChange={(v) => setModel(v as ModelName)}>
            <option value="deepseek-v4-flash" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Flash</option>
            <option value="deepseek-v4-pro" className="bg-[#1e293b] text-[#f1f5f9]">DeepSeek V4 Pro</option>
          </Select>
        </Field>

        <SliderField label="温度" value={temperature} min={0} max={2} step={0.05}
          onChange={setTemperature} left="精确" right="创意" />

        <SliderField label="最大 Token" value={maxTokens} min={512} max={32768} step={512}
          onChange={setMaxTokens} displayValue={String(maxTokens)} />

        <SliderField label="Top P" value={topP} min={0} max={1} step={0.05}
          onChange={setTopP} />

        <ToggleField label="记忆系统" enabled={memoryEnabled} onChange={setMemoryEnabled} />

        {/* Skills selection (checkboxes) */}
        <div>
          <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
            挂载技能
          </label>
          <div className="space-y-1.5">
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => toggleSkillSelect(skill.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-150 ${
                  selectedSkills.includes(skill.id)
                    ? "border-[#3b82f6] bg-[#3b82f6]/10"
                    : "border-[#334155] bg-[#1a1a2e] hover:border-[#64748b]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#f1f5f9] truncate">
                    {skill.name}
                  </div>
                  <div className="text-[10px] text-[#64748b] mt-0.5">
                    {skill.type === "function_call" ? "🔧 函数调用" : "📝 提示注入"}
                  </div>
                </div>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                  selectedSkills.includes(skill.id)
                    ? "bg-[#3b82f6] border-[#3b82f6]"
                    : "border-[#334155]"
                }`}>
                  {selectedSkills.includes(skill.id) && <Check size={10} className="text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Prompt */}
        <Field label="System Prompt *">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="定义这个人格的行为方式、回答风格、专业领域..."
            rows={8}
            className="w-full rounded-lg border border-[#334155] bg-[#1a1a2e] px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent resize-none font-mono leading-relaxed transition-all duration-150"
          />
        </Field>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#334155] space-y-2">
        <button
          onClick={handleCreate}
          disabled={!isValid}
          className="w-full rounded-xl bg-[#3b82f6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2563eb] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all duration-150 shadow-lg shadow-blue-500/20"
        >
          ✨ 创建人格
        </button>
        <button
          onClick={onCancel}
          className="w-full rounded-xl border border-[#334155] bg-transparent px-4 py-2.5 text-sm text-[#94a3b8] hover:bg-[#334155]/40 hover:text-[#f1f5f9] active:scale-[0.98] transition-all duration-150"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ======================== SHARED MICRO-COMPONENTS ========================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, onBlur, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[#334155] bg-[#1a1a2e] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all duration-150"
    />
  );
}

function Select({ value, onChange, children }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#334155] bg-[#1a1a2e] text-[#f1f5f9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent cursor-pointer appearance-none transition-all duration-150"
    >
      {children}
    </select>
  );
}

function SliderField({ label, value, min, max, step, onChange, left, right, displayValue }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  left?: string;
  right?: string;
  displayValue?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
          {label}
        </label>
        <span className="text-xs text-[#94a3b8] font-mono">
          {displayValue ?? value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-[#334155] cursor-pointer accent-[#3b82f6] [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[#3b82f6] [&::-webkit-slider-thumb]:shadow-md"
      />
      {(left || right) && (
        <div className="flex justify-between text-[10px] text-[#64748b] mt-1">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

function ToggleField({ label, enabled, onChange }: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
        {label}
      </label>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          enabled ? "bg-[#3b82f6]" : "bg-[#334155]"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SkillToggleRow({ skill, onToggle }: { skill: Skill; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#1a1a2e] border border-[#334155] px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#f1f5f9] truncate">{skill.name}</div>
        <div className="text-[10px] text-[#64748b] mt-0.5">
          {skill.type === "function_call" ? "🔧 函数调用" : "📝 提示注入"}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          skill.enabled ? "bg-green-500" : "bg-[#334155]"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
            skill.enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

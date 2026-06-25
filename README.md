# 💬 ChatRobot — 桌面 AI 聊天机器人

基于 **Tauri 2.x + React 19 + TypeScript + Tailwind CSS 3** 构建的桌面端 AI 聊天应用，接入 DeepSeek V4 API（OpenAI 兼容），支持多人格、技能系统、记忆系统和 SQLite 持久化存储。

## ✨ 功能

- **🚀 DeepSeek V4 API** — OpenAI 兼容格式，支持 `deepseek-v4-flash` 和 `deepseek-v4-pro` 模型
- **📝 流式输出** — SSE 打字机效果，Markdown 渲染 + 代码语法高亮
- **👥 多人格系统** — 内置通用助手、创意写作、编程导师，支持自定义创建
- **🔧 技能系统** — `function_call` 型（Tool Use）和 `prompt_injection` 型技能
- **🧠 记忆系统** — 对话结束时自动提取关键信息，下次对话注入 System Prompt
- **💾 SQLite 持久化** — 会话和聊天记录自动保存，应用重启不丢失
- **🗄️ 系统托盘** — 关闭窗口隐藏到托盘，右键菜单快速呼出
- **⌨️ 全局快捷键** — `Alt+Space` 一键切换窗口显隐
- **🌙 深色主题** — 精心设计的暗色 UI，三栏布局
- **📝 会话重命名** — 双击会话标题即可编辑

## 📸 预览

<!-- 替换为实际截图 -->
```
┌──────────────────┬────────────────────────────┬──────────────────┐
│   人格选择 🤖    │                            │  人格编辑面板     │
│   [新建对话]     │     你好！我是你的AI助手    │                  │
│                  │                            │  Model           │
│   ─ 会话历史 ─   │  用户: 今天天气怎么样？    │  Temperature     │
│   ├ 天气预报     │                            │  Max Tokens      │
│   ├ Python学习   │  AI: 由于我是本地AI...     │  Skills          │
│   └ ...         │                            │  Memory          │
│                  │  ┌──────────────────────┐  │                  │
│   ─────────────  │  │ 输入框...        [→] │  │  [保存修改]      │
│   🌙 深色模式    │  └──────────────────────┘  │                  │
│   🤖 人格管理    │                            │                  │
│   ⚙️ 设置       │                            │                  │
└──────────────────┴────────────────────────────┴──────────────────┘
```

## 📦 安装与运行

### 环境要求

- **Node.js** ≥ 18
- **Rust** (rustup) + MSVC 工具链
- **WebView2**（Windows 10/11 自带）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/HMR03/chatrobt.git
cd chatrobt

# 2. 安装前端依赖
npm install

# 3. 开发模式运行
npm run tauri dev

# 4. 生产构建
npm run tauri build
```

### 配置 API Key

1. 启动应用后点击左下角 **⚙️ 设置**
2. 在 DeepSeek API Key 输入框中填入你的 Key（格式：`sk-...`）
3. 点击保存，开始对话

> 获取 API Key：[platform.deepseek.com](https://platform.deepseek.com/)

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x (Rust) |
| 前端框架 | React 19 |
| 类型系统 | TypeScript |
| 构建工具 | Vite |
| CSS 框架 | Tailwind CSS 3 (PostCSS) |
| Markdown | react-markdown + remark-gfm |
| 代码高亮 | react-syntax-highlighter (Prism) |
| 图标 | Lucide React |
| 数据库 | SQLite (tauri-plugin-sql) |
| 安全存储 | tauri-plugin-store |
| 全局快捷键 | tauri-plugin-global-shortcut |
| 开机自启 | tauri-plugin-autostart |

## 📂 项目结构

```
src/
├── main.tsx                # React 入口
├── App.tsx                 # 根组件（三栏布局 + 数据编排）
├── styles.css              # Tailwind + 深色主题样式
├── types/index.ts          # TypeScript 类型定义
├── services/
│   ├── deepseek.ts         # DeepSeek API（流式 + 非流式）
│   ├── persona.ts          # 人格管理 + 内置人格/技能
│   ├── storage.ts          # SQLite 存储层
│   └── memory.ts           # 记忆提取与去重
├── hooks/useChat.ts        # 聊天核心 Hook（流式 + Function Calling）
├── contexts/AppContext.tsx # 全局状态管理
└── components/
    ├── Sidebar.tsx          # 左栏（人格切换/会话列表/双击重命名）
    ├── ChatArea.tsx         # 中间聊天消息流
    ├── ChatInput.tsx        # 底部输入框
    ├── MessageItem.tsx      # 消息气泡
    ├── MarkdownRenderer.tsx # Markdown + 代码高亮
    ├── PersonaEditor.tsx    # 右栏人格编辑/创建
    └── SettingsDialog.tsx   # 设置弹窗

src-tauri/
├── Cargo.toml              # Rust 依赖
├── tauri.conf.json          # Tauri 配置
├── capabilities/default.json # 权限配置
└── src/
    ├── main.rs              # Rust 入口
    └── lib.rs               # 插件注册/系统托盘/快捷键
```

## 📄 License

MIT

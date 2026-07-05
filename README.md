# GitHub Stars AI Tools

一个本地优先的 GitHub Stars 桌面管理工具。

它的目标不是做浏览器插件，而是把你的 GitHub Stars 同步到本地数据库，后续逐步支持 README 中文摘要、AI 检索、标签、笔记和注解同步。

## 当前能力

- 连接 GitHub 账号。
- 同步 GitHub Stars 到本地 SQLite。
- 抓取并缓存仓库 README。
- Star 工作台列表。
- 关键词、语言、标签筛选。
- 标签、笔记、阅读状态管理。
- 项目详情页展示 README、AI 摘要和用户注解。
- 增量同步与全量重扫。
- 通过 Secret Gist 导出/导入注解层数据。

## 技术栈

- 桌面端：Tauri 2
- 前端：React + TypeScript + Vite
- 后端：Rust
- 本地存储：SQLite
- 包管理：pnpm

## 环境准备

### 1. 安装 Node.js

项目要求：

```bash
node >= 24
pnpm >= 11
```

建议使用 `corepack` 管理 pnpm：

```bash
corepack enable
```

### 2. 安装 Rust

Tauri 后端需要 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

安装后检查：

```bash
rustc --version
cargo --version
```

### 3. macOS 需要 Xcode Command Line Tools

```bash
xcode-select --install
```

### 4. 检查 sqlite3

```bash
sqlite3 --version
```

macOS 通常自带 sqlite3。

## 安装依赖

进入项目目录：

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
```

安装前端依赖：

```bash
COREPACK_HOME="$PWD/.corepack" pnpm install
```

这里显式设置 `COREPACK_HOME`，是为了把 pnpm/corepack 缓存放在项目目录内，减少本机权限和缓存路径问题。

## 启动软件

### 启动桌面开发版

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm tauri dev
```

这会启动：

- Vite 前端开发服务。
- Tauri 桌面窗口。
- Rust 本地后端。

日常开发和试用软件，优先用这个命令。

### 只启动前端页面

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm dev
```

这个命令只启动浏览器里的前端页面，不会启动完整桌面能力。

适合只看 UI，但 GitHub Token、Keychain、SQLite、Tauri 命令等桌面能力可能不可用。

## 测试和检查

当前项目还没有完整自动化测试套件。现阶段用下面这些命令做基础检查。

### 1. 检查共享包 TypeScript

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm build:packages
```

检查内容：

- `packages/domain`
- `packages/storage`
- `packages/github`
- `packages/ai`
- `packages/search`
- `packages/worker`

### 2. 检查 SQLite 迁移

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm --filter @stars-ai/storage verify:migrations
```

这个命令会验证数据库 migration 是否可以正常执行。

### 3. 检查前端构建

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm build
```

检查内容：

- TypeScript 类型检查。
- Vite 前端构建。
- 共享包构建。

### 4. 检查 Rust 格式

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
cargo fmt --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml" --check
```

如果这个命令失败，并且只是格式问题，可以执行：

```bash
cargo fmt --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
```

### 5. 检查 Rust 编译

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
cargo check --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
```

这个命令只检查 Rust 后端能否编译，不会生成安装包。

### 推荐检查顺序

每次准备提交或打包前，建议按这个顺序跑：

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm build:packages
COREPACK_HOME="$PWD/.corepack" pnpm --filter @stars-ai/storage verify:migrations
COREPACK_HOME="$PWD/.corepack" pnpm build
cargo fmt --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml" --check
cargo check --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
```

## 打包软件

### 1. 先确认构建通过

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm build
cargo check --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
```

### 2. 执行 Tauri 打包

```bash
cd /Users/xingranya/Downloads/GitHub-clone/GitHub-Stars-AI-Tools
COREPACK_HOME="$PWD/.corepack" pnpm tauri build
```

### 3. 找到安装包

打包产物通常在：

```bash
apps/desktop/src-tauri/target/release/bundle/
```

macOS 下常见产物包括：

- `.dmg`
- `.app`

如果只想找最终包，可以打开这个目录：

```bash
open apps/desktop/src-tauri/target/release/bundle/
```

## 第一次使用流程

1. 启动桌面开发版：

```bash
COREPACK_HOME="$PWD/.corepack" pnpm tauri dev
```

2. 在应用里连接 GitHub。
3. 保存 GitHub Token。
4. 点击同步 Stars。
5. 点击抓取 README。
6. 在 Star 工作台里搜索、筛选、打标签、写笔记。
7. 如需跨设备迁移注解，使用 Secret Gist 导出/导入。

## GitHub Token 说明

当前版本使用 GitHub Personal Access Token。

Token 只用于本地访问 GitHub API，并保存到 macOS Keychain。

不要把 Token 写进：

- README
- 代码
- `.env`
- issue
- 截图
- 日志

## 注解 Gist 同步说明

Gist 同步只处理用户注解层数据：

- tags
- repo_tags
- notes
- read_status

不会同步：

- GitHub Token
- GitHub 仓库事实数据
- README 缓存
- AI 摘要
- AI 向量数据
- 完整 SQLite 数据库

导入时只会合并到当前本地已经存在的仓库，不会凭 Gist 创建新的 GitHub 仓库记录。

## 常见问题

### 1. `pnpm install` 下载失败

如果网络或 DNS 不稳定，可以稍后重试：

```bash
COREPACK_HOME="$PWD/.corepack" pnpm install
```

### 2. `cargo check` 失败并提示旧路径

如果项目目录曾经改名，Rust target 缓存可能还引用旧路径。

可以清理后重试：

```bash
cargo clean --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
cargo check --manifest-path "$PWD/apps/desktop/src-tauri/Cargo.toml"
```

### 3. 只运行 `pnpm dev` 看不到桌面能力

`pnpm dev` 只启动 Vite 前端。

完整桌面应用请运行：

```bash
COREPACK_HOME="$PWD/.corepack" pnpm tauri dev
```

### 4. 打包后找不到产物

先确认打包命令完成：

```bash
COREPACK_HOME="$PWD/.corepack" pnpm tauri build
```

然后查看：

```bash
open apps/desktop/src-tauri/target/release/bundle/
```

## 项目目录

```text
apps/desktop/                 # Tauri + React 桌面应用
apps/desktop/src-tauri/       # Rust 后端与 Tauri 配置
packages/domain/              # 领域类型和边界
packages/storage/             # 本地存储接口与迁移
packages/github/              # GitHub 接入边界
packages/ai/                  # AI Provider 抽象
packages/search/              # 搜索 DSL 与解释结构
packages/worker/              # 同步、摘要、向量化编排
packages/storage/migrations/  # SQLite migration
docs/                         # 产品、架构、进度文档
tasks/                        # 任务拆解与执行记录
```

## 当前开发状态

当前已完成：

- Phase 1：项目骨架与基础设施
- Phase 2：GitHub 同步闭环
- Phase 3：Star 管理核心能力
- Phase 4：AI 知识库 MVP
- Phase 5：自然语言检索基础
- Phase 6.1：增量同步与全量重扫
- Phase 6.2：Gist 注解导入导出

下一步：

- Phase 6.3：成本与任务监控
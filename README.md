<div align="center">
  <img src="apps/desktop/public/icon.png" alt="GitHub-Stars-AI-Tools 应用图标" width="128" />
  <h1>GitHub-Stars-AI-Tools</h1>
  <p><strong>把 GitHub Stars 变成可搜索、可总结、可继续探索的本地 AI 知识库。</strong></p>
  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-111827?style=for-the-badge" /></a>
    <a href="https://tauri.app/"><img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-087EA4?style=for-the-badge&logo=react&logoColor=white" /></a>
    <a href="https://www.rust-lang.org/"><img alt="Rust" src="https://img.shields.io/badge/Rust-backend-B7410E?style=for-the-badge&logo=rust&logoColor=white" /></a>
  </p>
</div>

| 项目介绍 | 项目介绍 |
| --- | --- |
| ![GitHub-Stars-AI-Tools 项目介绍图 1](https://img1.tucang.cc/api/image/show/7e91d81c993c252de122856fa3dac254) | ![GitHub-Stars-AI-Tools 项目介绍图 2](https://img1.tucang.cc/api/image/show/4a6330054ddb54b0d4ef400441d19df2) |
| ![GitHub-Stars-AI-Tools 项目介绍图 3](https://img1.tucang.cc/api/image/show/f6a45355aa40bb818943da75d870f2ff) | ![GitHub-Stars-AI-Tools 项目介绍图 4](https://img1.tucang.cc/api/image/show/530b7f7f3bdbde763adac670ddcb3936) |

## 适合谁

- GitHub Stars 很多，经常忘记项目用途和同类差异的人。
- 希望把 README、标签、笔记和 AI 摘要沉淀到本机的人。
- 想用自然语言搜索、整理技术栈、发现相似项目的人。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| Stars 同步 | 全量/增量同步 GitHub Stars 到本机 SQLite |
| README 知识库 | 缓存 README、Topics、语言、标签、笔记和阅读状态 |
| AI 摘要 | 支持 OpenAI、OpenAI 兼容接口与 Anthropic，生成中文摘要和关键词 |
| 自然语言搜索 | 跨仓库名称、描述、README、AI 文档、标签和笔记检索 |
| AI 标签网络 | 根据 Stars 自动生成标签建议和仓库关联 |
| 相似项目发现 | 根据已收藏项目生成 GitHub Search 策略，发现替代项目 |

## 快速开始

系统要求：macOS 10.15+、Windows 10+ 或 Linux。安装包用户不需要安装 Node.js、pnpm 或 Rust。

1. 安装并启动 GitHub-Stars-AI-Tools。
2. 在欢迎页或设置页连接 GitHub Personal Access Token。
3. 点击“同步 Stars”，把收藏仓库写入本机数据库。
4. 点击“抓取 README”，缓存仓库详情。
5. 可选：在设置页配置 AI 服务，生成摘要、标签网络和相似项目推荐。

## 数据与隐私

- GitHub Token 和 AI API Key 保存到系统凭据管理器，不写入 localStorage。
- Stars、README、标签、笔记和 AI 文档保存在本机数据库。
- AI 功能只有在你主动配置并使用时才会请求对应服务。
- Gist 同步使用私密 Gist，仅包含标签、笔记、阅读状态等用户注解数据。

## 应用更新

应用启动时会静默检查新版本；发现更新后会在应用内提示，也可以在“设置 → 通用设置 → 应用更新”手动检查、安装并重启。

## 维护者文档

构建、测试、发版和应用内更新签名流程见 [发布维护文档](docs/release.md)。

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)。源码可用于个人学习、研究、非营利组织和非商业场景；商业使用、商业再分发或商业产品集成需要先获得书面授权。

## 致谢

感谢 [Tauri](https://tauri.app/)、[React](https://react.dev/)、[Rust](https://www.rust-lang.org/)、[SQLite](https://www.sqlite.org/)、[pnpm](https://pnpm.io/) 以及相关开源生态。

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readBinary = (path) => readFileSync(resolve(root, path));

function pngSize(path) {
  const bytes = readBinary(path);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${path} 必须是 PNG 文件`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function sha256(path) {
  return createHash('sha256').update(readBinary(path)).digest('hex');
}

const readme = read('README.md');
const progressMaster = read('docs/progress/MASTER.md');
const taskTodo = read('tasks/todo.md');
const taskPlan = read('tasks/plan.md');
const productSpec = read('docs/plan/product-spec.md');
const architectureSpec = read('docs/plan/architecture-spec.md');
const projectOverview = read('docs/analysis/project-overview.md');
const moduleInventory = read('docs/analysis/module-inventory.md');
const phase2Summary = read('docs/phase2-complete.md');
const license = read('LICENSE');
const indexHtml = read('apps/desktop/index.html');
const rootPackage = JSON.parse(read('package.json'));
const desktopPackage = JSON.parse(read('apps/desktop/package.json'));
const workspacePackages = [
  ['package.json', rootPackage],
  ['apps/desktop/package.json', desktopPackage],
  ['packages/ai/package.json', JSON.parse(read('packages/ai/package.json'))],
  ['packages/domain/package.json', JSON.parse(read('packages/domain/package.json'))],
  ['packages/github/package.json', JSON.parse(read('packages/github/package.json'))],
  ['packages/search/package.json', JSON.parse(read('packages/search/package.json'))],
  ['packages/storage/package.json', JSON.parse(read('packages/storage/package.json'))],
  ['packages/worker/package.json', JSON.parse(read('packages/worker/package.json'))],
];
const tauriConfig = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'));
const shellSource = read('apps/desktop/src/components/app-shell.tsx');
const layoutSource = read('apps/desktop/src/components/app-layout.tsx');
const settingsSource = read('apps/desktop/src/pages/settings.tsx');
const welcomeSource = read('apps/desktop/src/components/welcome-flow.tsx');
const authSource = read('apps/desktop/src-tauri/src/auth.rs');

assert.equal(rootPackage.name, 'github-stars-ai-tools', '根 package 名应保持 npm 兼容的小写项目名');
assert.equal(desktopPackage.name, '@gsat/desktop', '桌面包名应使用 GSAT scope');
for (const [packagePath, packageJson] of workspacePackages) {
  assert.equal(packageJson.license, 'SEE LICENSE IN LICENSE', `${packagePath} 必须指向仓库 LICENSE 文件，避免继续声明 MIT`);
  assert.equal(packageJson.homepage, 'https://github.com/xingranya/GitHub-Stars-AI-Tools', `${packagePath} 必须声明真实项目主页`);
  assert.equal(packageJson.repository?.type, 'git', `${packagePath} 必须声明 git repository`);
  assert.equal(packageJson.repository?.url, 'https://github.com/xingranya/GitHub-Stars-AI-Tools.git', `${packagePath} 必须声明真实仓库地址`);
}
assert.equal(tauriConfig.productName, 'GitHub-Stars-AI-Tools', 'Tauri 产品名必须是 GitHub-Stars-AI-Tools');
assert.equal(tauriConfig.app.windows[0].title, 'GitHub-Stars-AI-Tools', '桌面窗口标题必须使用项目全称');
assert.equal(tauriConfig.build.beforeDevCommand, 'pnpm dev', 'Tauri 开发态必须通过桌面包 dev 脚本启动前端');
assert.equal(tauriConfig.build.devUrl, 'http://127.0.0.1:1420', 'Tauri devUrl 必须固定到本地 1420 端口');
assert.match(desktopPackage.scripts.dev, /--port 1420\b/, '桌面 dev 脚本端口必须与 Tauri devUrl 一致');
assert.match(desktopPackage.scripts.dev, /--strictPort\b/, '桌面 dev 脚本必须启用 strictPort，避免端口漂移导致 Tauri 空白');
assert.equal(typeof tauriConfig.app.security.csp, 'string', '发布版必须启用明确 CSP，不能使用 csp: null');
assert.match(tauriConfig.app.security.csp, /connect-src[^;]*ipc:/, 'CSP 必须允许 Tauri IPC 通信');
assert.match(tauriConfig.app.security.csp, /img-src[^;]*https:/, 'CSP 必须允许 GitHub 头像和 README HTTPS 图片');
assert.match(tauriConfig.app.security.csp, /style-src[^;]*fonts\.googleapis\.com/, 'CSP 必须允许 Google Fonts 样式表');
assert.match(tauriConfig.app.security.csp, /font-src[^;]*fonts\.gstatic\.com/, 'CSP 必须允许 Google Fonts 字体文件');
assert.match(tauriConfig.app.security.csp, /frame-src 'none'/, 'CSP 必须禁止 frame 嵌入');
assert.match(tauriConfig.app.security.csp, /object-src 'none'/, 'CSP 必须禁止 object 资源');

assert.match(readme, /^# GitHub-Stars-AI-Tools/m, 'README 标题必须使用项目全称');
assert.match(readme, /\[!\[License\][\s\S]*\(LICENSE\)/, 'README 必须链接到仓库 LICENSE 文件');
assert.match(readme, /PolyForm Noncommercial License 1\.0\.0/, 'README 必须声明非商用许可');
assert.match(readme, /不得用于商业托管、商业再分发、商业产品集成或其他商业用途/, 'README 必须明确禁止商用行为');
assert.match(license, /# PolyForm Noncommercial License 1\.0\.0/, 'LICENSE 必须使用 PolyForm Noncommercial License 1.0.0');
assert.match(license, /Required Notice: Copyright \(c\) 2026 xingranya\./, 'LICENSE 必须包含当前版权归属');
assert.match(license, /Commercial use[\s\S]*requires separate written permission/, 'LICENSE 必须明确商用需要单独授权');
assert.match(readme, /\bGSAT\b/, 'README 必须说明 GSAT 缩写');
assert.match(readme, /https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools\.git/, 'README clone 地址不能使用占位仓库');
assert.match(readme, /\[xingranya\/GitHub-Stars-AI-Tools\]\(https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools\)/, 'README 必须提供真实项目仓库入口');
assert.match(readme, /OpenAI 兼容接口/, 'README 必须记录 OpenAI 兼容接口配置');
assert.match(readme, /Anthropic/, 'README 必须记录 Anthropic 配置');
assert.match(readme, /React-19/, 'README 徽章必须与实际 React 19 依赖一致');
assert.match(readme, /React 19 \+ TypeScript \+ Vite \+ Tailwind CSS/, 'README 技术栈必须与实际 React 19 依赖一致');
assert.match(readme, /pnpm verify:mvp/, 'README 必须记录 MVP 静态验收命令');
assert.match(readme, /`pnpm verify:mvp`[\s\S]*?不生成安装包，并会在结束后清理 `dist`、`target` 和 `tsconfig\.tsbuildinfo` 构建产物/, 'README 必须说明 verify:mvp 不保留构建产物');
assert.doesNotMatch(
  readme,
  /### 提交前检查[\s\S]*?```bash[\s\S]*?pnpm verify:release[\s\S]*?```/,
  'README 提交前检查不能运行 verify:release，避免日常提交生成安装包二进制',
);
assert.match(
  readme,
  /`pnpm verify:release` 会生成当前系统安装包，只在准备发版或检查安装包时运行/,
  'README 必须明确 verify:release 只用于发版或安装包检查',
);
assert.match(readme, /真实链路复核只在应用内进行[\s\S]*?AI 请求地址[\s\S]*?模型 ID[\s\S]*?相似推荐联动/, 'README 必须记录应用内 AI 推荐联动真实链路复核');
assert.match(readme, /不需要安装前配置环境变量或额外脚本/, 'README 必须明确普通安装包用户不需要安装前配置环境变量或额外脚本');
assert.match(readme, /真实链路自检[\s\S]*?本地 SQLite 数据库[\s\S]*?应用设置目录写入权限[\s\S]*?AI 标签网络/, 'README 必须说明发布包真实链路自检覆盖本地数据库、应用设置存储与 AI 标签网络');
assert.match(readme, /持久化发布包自检记录[\s\S]*?不保存 Token、AI Key 或错误详情/, 'README 必须说明发布包自检记录的非敏感持久化范围');
assert.match(readme, /\[x\] Phase 9: 成本统计与发布包自检记录/, 'README 路线图必须标记成本统计与发布包自检记录已完成');
assert.match(progressMaster, /Phase 9 静态验收与发布包自检闭环完成/, '进度总览必须对齐当前 Phase 9 完成状态');
assert.match(progressMaster, /Phase 10：zvec 本地向量索引与混合语义检索/, '进度总览必须保留 zvec 后续计划');
assert.match(progressMaster, /不要求普通用户参与发布验收/, '进度总览必须明确普通用户不参与发布验收');
assert.match(progressMaster, /日常提交检查不运行会生成安装包的 `pnpm verify:release`/, '进度总览必须说明日常提交不运行安装包打包命令');
assert.match(taskTodo, /\[x\] Task 6\.3: 成本与任务监控/, '任务清单必须标记成本与任务监控已完成');
assert.doesNotMatch(taskTodo, /\bmock provider\b/i, '任务清单不能继续描述 mock provider 作为当前 AI 运行时');
assert.match(taskPlan, /\[x\] Task 7\.1: AI 标签网络/, '实现计划必须记录 AI 标签网络已完成');
assert.match(taskPlan, /\[x\] Task 8\.2: GitHub Actions 三端发版链路/, '实现计划必须记录三端发版链路已完成');
assert.match(taskPlan, /\[ \] Task 10\.2: `VectorIndexPort` 与 zvec adapter/, '实现计划必须保留 zvec adapter 后续任务');
assert.match(taskTodo, /\[ \] Task 5\.2: zvec 本地向量索引/, '任务清单必须把 zvec 本地向量索引标记为待实现');
assert.doesNotMatch(taskTodo, /sandbox-exec/, '任务清单不能保留旧环境 sandbox-exec 阻塞说明');
assert.doesNotMatch(`${taskPlan}\n${taskTodo}\n${productSpec}\n${architectureSpec}\n${moduleInventory}`, /MiniMax/, '公开计划文档不能继续把 MiniMax 写成当前默认方向');
assert.match(productSpec, /OpenAI、OpenAI 兼容接口与 Anthropic/, '产品规格必须对齐当前三类 AI 服务');
assert.match(architectureSpec, /OpenAI-compatible[\s\S]*Anthropic/, '架构规格必须记录 OpenAI 兼容与 Anthropic 运行时');
assert.match(architectureSpec, /当前知识库 AI 只要求聊天协议，不要求用户配置向量模型/, '架构规格必须明确当前主链路不要求向量模型');
assert.match(architectureSpec, /embed\?\(input: EmbedInput\)/, '架构规格必须把 Embedding 标为可选接口');
assert.match(moduleInventory, /Embedding（后续可选增强，不是当前上线主链路）/, '模块清单必须把 Embedding 标为后续可选增强');
assert.match(taskTodo, /结构不兼容时删除并重建/, '任务清单必须明确本机测试期旧 SQLite 不做迁移');
assert.doesNotMatch(projectOverview, /暂未发现应用源码|从零规划新产品/, '项目分析文档不能继续描述旧的空仓库状态');
assert.match(projectOverview, /普通用户路径是安装客户端后在应用内填写 GitHub Token 与 AI Key/, '项目分析文档必须说明当前安装包用户路径');
assert.doesNotMatch(phase2Summary, /功能待接入|UI 演示|准备开始 Phase 3|需要：/, '阶段总结不能保留已过期的待接入或演示文案');
assert.match(phase2Summary, /全局搜索栏可跳转到真实本地知识库检索/, '阶段总结必须说明全局搜索已接入真实检索链路');
assert.match(phase2Summary, /设置页支持 OpenAI、OpenAI 兼容接口、Anthropic 和关闭 AI/, '阶段总结必须记录当前真实 AI Provider 范围');
assert.doesNotMatch(productSpec, /GitHub PAT 或 OAuth Device Flow 登录/, '产品规格不能继续把未实现的 OAuth Device Flow 写入当前上线范围');
assert.match(productSpec, /## 当前上线范围[\s\S]*OpenAI、OpenAI 兼容接口与 Anthropic[\s\S]*AI 标签网络生成[\s\S]*GitHub 相似项目发现/, '产品规格必须覆盖当前已实现 AI 主链路');
assert.match(productSpec, /## 后续增强范围[\s\S]*zvec 本地向量索引与混合语义检索/, '产品规格必须把 zvec 标为后续增强');
assert.match(readme, /真实链路复核只在应用内进行[\s\S]*?不需要安装前配置环境变量或额外脚本/, 'README 必须说明普通用户无需预先配置凭据');
assert.match(readme, /安装包用户只需要安装 GitHub-Stars-AI-Tools 客户端，不需要安装 Node\.js、pnpm 或 Rust；账号与 AI 服务都在应用内设置/, 'README 必须把安装包用户路径与开发工具要求分开');
assert.match(readme, /开发者从源码构建时需要 Node\.js >= 24、pnpm >= 11 和 Rust/, 'README 必须把 Node、pnpm、Rust 限定为开发者构建要求');
assert.match(readme, /应用界面中填写/, 'README 必须说明 GitHub 和 AI 配置在应用界面中填写');
assert.match(readme, /系统凭据管理器/, 'README 必须说明 GitHub Token 和 AI API Key 使用系统凭据管理器');
assert.match(readme, /macOS Keychain/, 'README 必须说明 macOS 使用 Keychain');
assert.match(readme, /Windows Credential Manager/, 'README 必须说明 Windows 使用 Credential Manager');
assert.match(readme, /Linux Secret Service/, 'README 必须说明 Linux 使用 Secret Service');
assert.ok(!readme.includes('yourusername'), 'README 不应保留占位用户名');

assert.match(indexHtml, /<link rel="icon" type="image\/png" href="\/icon\.png" \/>/, 'favicon 必须使用应用图标');
assert.match(indexHtml, /<link rel="apple-touch-icon" href="\/icon\.png" \/>/, 'apple-touch-icon 必须使用应用图标');
assert.match(shellSource, /src="\/icon\.png"/, '应用壳左上角必须使用应用图标');
assert.match(layoutSource, /src="\/icon\.png"/, '主布局左上角必须使用应用图标');
assert.doesNotMatch(layoutSource, /https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools|项目仓库[\s\S]*open_in_new/, '主布局首页不能重复显示项目仓库入口');
assert.match(settingsSource, /https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools/, '设置页必须提供真实项目仓库按钮');
assert.match(settingsSource, /项目仓库[\s\S]*open_in_new/, '项目仓库按钮必须有清晰文案和外部打开图标');
assert.match(settingsSource, /PolyForm Noncommercial 1\.0\.0/, '设置页必须展示当前非商用许可');
assert.match(settingsSource, /商业使用、集成或再分发需要另行获得授权/, '设置页必须提示商业使用需要授权');
assert.match(settingsSource, /https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools\/issues/, '设置页必须提供 GitHub Issues 问题反馈入口');
assert.match(settingsSource, /bug_report[\s\S]*问题反馈/, '问题反馈入口必须有清晰文案和图标');
assert.match(settingsSource, /https:\/\/github\.com\/xingranya\/GitHub-Stars-AI-Tools\/blob\/main\/LICENSE/, '设置页必须提供 LICENSE 外链');
assert.match(settingsSource, /查看许可证[\s\S]*确认非商用授权边界/, '设置页必须解释许可证入口用途');
assert.match(settingsSource, /#%E8%87%B4%E8%B0%A2/, '设置页必须提供 README 致谢锚点入口');
assert.match(settingsSource, /开源组件鸣谢[\s\S]*查看项目依赖与生态致谢/, '设置页必须提供开源组件鸣谢入口');
assert.match(welcomeSource, /src="\/icon\.png"/, '欢迎页必须使用应用图标');
assert.match(authSource, /keyring::Entry/, '安全凭据必须使用跨平台 keyring Entry');
assert.doesNotMatch(authSource, /暂只支持 macOS/, '安全凭据不能退回 macOS-only 实现');

const requiredBundleIcons = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.icns',
  'icons/icon.ico',
  'icons/icon.png',
];
assert.deepEqual(tauriConfig.bundle.icon, requiredBundleIcons, 'Tauri bundle 图标必须覆盖任务栏、Dock 和安装包入口');

const iconFiles = [
  'apps/desktop/public/icon.png',
  'apps/desktop/public/icon.svg',
  'apps/desktop/src-tauri/icons/32x32.png',
  'apps/desktop/src-tauri/icons/128x128.png',
  'apps/desktop/src-tauri/icons/128x128@2x.png',
  'apps/desktop/src-tauri/icons/icon.icns',
  'apps/desktop/src-tauri/icons/icon.ico',
  'apps/desktop/src-tauri/icons/icon.png',
];
for (const iconFile of iconFiles) {
  assert.ok(existsSync(resolve(root, iconFile)), `${iconFile} 必须存在`);
}

assert.deepEqual(pngSize('apps/desktop/public/icon.png'), { width: 512, height: 512 }, '前端应用图标必须是 512x512 PNG');
assert.deepEqual(pngSize('apps/desktop/src-tauri/icons/icon.png'), { width: 512, height: 512 }, 'Tauri 主应用图标必须是 512x512 PNG');
assert.deepEqual(pngSize('apps/desktop/src-tauri/icons/32x32.png'), { width: 32, height: 32 }, '32x32 bundle 图标尺寸不正确');
assert.deepEqual(pngSize('apps/desktop/src-tauri/icons/128x128.png'), { width: 128, height: 128 }, '128x128 bundle 图标尺寸不正确');
assert.deepEqual(pngSize('apps/desktop/src-tauri/icons/128x128@2x.png'), { width: 256, height: 256 }, '128x128@2x bundle 图标尺寸不正确');
assert.equal(sha256('apps/desktop/public/icon.png'), sha256('apps/desktop/src-tauri/icons/icon.png'), '前端图标和 Tauri 主图标必须保持一致');

console.log('Branding and README verification passed.');

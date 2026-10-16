# 🤝 贡献指南 / Contributing to TempoLens

感谢你愿意参与 TempoLens！本项目坚持**零依赖、零构建、可离线**三大原则，
任何贡献都应尽量不引入新的运行时依赖。Thank you for contributing!

---

## 🧭 行为准则 / Code of Conduct

- 尊重所有贡献者，讨论对事不对人。
- Be kind, be constructive, assume good intent.

## 🐛 提交 Issue / Reporting Issues

- **Bug 报告**请包含：复现步骤、期望行为、实际行为、浏览器与操作系统版本。
- **功能建议**请说明使用场景与期望的交互。
- 安全相关问题请勿公开提交 Issue，参见下文安全政策。

## 🔀 提交 PR / Pull Requests

1. Fork 本仓库并创建特性分支：`git checkout -b feat/my-feature`
2. 提交信息遵循 **Angular 提交规范**（见下）。
3. 确保本地校验全部通过：
   ```bash
   npm run check    # 语法校验（node --check，零依赖）
   npm test         # 单元测试（node --test，零依赖）
   npm run build    # 单文件打包
   npm run smoke    # 冒烟测试
   ```
   或一键执行：`npm run verify`
4. 保持 PR 聚焦：一个 PR 只做一件事。
5. 涉及界面文案的修改，必须同步更新 **全部三种语言**（zh-CN / zh-TW / en）。

## 📐 Angular 提交规范 / Commit Convention

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

**type 取值：**

| type | 含义 |
|---|---|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档变更 |
| `refactor` | 重构（不改变外部行为） |
| `test` | 测试用例增改 |
| `chore` | 构建/工程化/杂项 |
| `perf` | 性能优化 |
| `style` | 代码格式（不影响逻辑） |

**scope 建议：** `core` / `audio` / `ui` / `i18n` / `ci` / `docs` / `build`

**示例：**
- `feat(core): add polyrhythm cycle preview to settings`
- `fix(scheduler): re-anchor grid cursor on tempo change`
- `docs(i18n): complete Traditional Chinese strings`

## 🏗️ 代码规范 / Code Style

- 缩进 2 空格；单引号；语句结尾分号。
- 核心模块采用 UMD 包装（浏览器全局 + Node `require` 双兼容）。
- 公共函数必须写 JSDoc 注释（中英双语说明）。
- 不引入任何运行时依赖；开发工具同样保持零依赖（仅 Node 内置模块）。
- 提交前运行 `npm run check`，确保 `node --check` 全部通过。

## 🌐 国际化 / Internationalization

新增界面文案时：

1. 在 `src/core/i18n.js` 的 `MESSAGES` 中为 **zh-CN、zh-TW、en** 三个语言同时添加键值。
2. 键名使用小写点分命名，如 `poly.cycle`。
3. 使用母语级表达，禁止机翻；繁体中文使用台湾地区惯用术语（如「設定」「資料」「練習」）。

## 🔒 安全政策 / Security

- 本项目为纯前端应用，不收集、不上传任何用户数据；练习数据仅存于浏览器 `localStorage`。
- 如发现安全问题，请通过 GitHub Security Advisory 私下报告。

## 📄 许可证 / License

提交即表示你同意以 [MIT](./LICENSE) 协议发布你的贡献。

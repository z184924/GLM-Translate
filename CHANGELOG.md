# Change Log

All notable changes to the "GLM-Translate" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.7] - 2026-08-29

### Added
- 深度思考模式配置 `enableThinking`（默认关闭；始终显式发送 `thinking` 参数，GLM-4.5+ 系列生效，旧模型忽略）
- 思考级别配置 `reasoningEffort`（`low`/`medium`/`high`/`xhigh`/`max`，默认 `low`；需 GLM-5.2+ 模型，旧模型忽略）
- 翻译命令支持自定义快捷键：键盘快捷方式（Ctrl+K Ctrl+S）中搜索 GLM-Translate 绑定即可
- 翻译结果缓存（上限 100 条），重复翻译同一段文本不再调用 API
- 诊断日志：输出面板 GLM-Translate 通道记录请求参数、首块延迟、分块数与总耗时
- 流式时序诊断脚本 `scripts/stream-probe.mjs`（纯 Node 直连 GLM，绕开扩展环境定位延迟问题）

### Changed
- 翻译改为流式输出：进度通知实时显示纯文本译文，完成后才以 Markdown 渲染展示；进度通知支持取消
- 移除鼠标悬停自动翻译，仅保留右键菜单「翻译」触发（避免误触发消耗 token）
- 默认模型由 `glm-4-flash` 更换为免费的 `glm-4.7-flash`
- 选中文本超过 5000 字符时提示并取消翻译
- 移除译文 Markdown 的可信标记（`isTrusted`），避免模型输出命令链接被点击执行的风险
- 开发与构建流程由 npm 切换到 pnpm

### Fixed
- 翻译 API 调用失败时弹出错误提示（此前异常未被捕获）

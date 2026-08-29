# Change Log

All notable changes to the "GLM-Translate" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 修复：翻译 API 调用出错后悬停翻译永久失效的问题（`buttonFlag` 卡死），并增加错误提示
- 修复：悬停翻译展示 Markdown 格式（原构建的 MarkdownString 未生效）
- 新增：`enableThinking` 配置项，支持深度思考模式（默认关闭，显式发送 `thinking` 参数）
- 新增：`reasoningEffort` 配置项，支持思考级别（low/medium/high/xhigh/max，需 GLM-5.2+）
- 新增：翻译结果缓存，同一选区重复悬停不再重复调用 API；悬停移开时取消进行中的请求
- 变更：默认模型由 `glm-4-flash` 更换为免费的 `glm-4.7-flash`
- 变更：移除译文 Markdown 的可信标记（`isTrusted`），避免模型输出命令链接注入风险；增加选中文本长度限制（5000 字符）

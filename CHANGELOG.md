# Change Log

All notable changes to the "GLM-Translate" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- 变更：翻译改为流式输出，进度通知实时显示译文（纯文本），完成后再渲染 Markdown 样式；进度通知支持取消
- 变更：移除鼠标悬停自动翻译（节省 token、避免干扰操作），仅保留右键菜单「翻译」触发
- 新增：翻译命令支持自定义快捷键（键盘快捷方式中搜索 GLM-Translate 绑定）
- 修复：翻译 API 调用出错后悬停翻译永久失效的问题（`buttonFlag` 卡死），并增加错误提示
- 修复：悬停翻译展示 Markdown 格式（原构建的 MarkdownString 未生效）
- 新增：`enableThinking` 配置项，支持深度思考模式（默认关闭，显式发送 `thinking` 参数）
- 新增：`reasoningEffort` 配置项，支持思考级别（low/medium/high/xhigh/max，需 GLM-5.2+）
- 新增：翻译结果缓存，重复翻译同一段文本不再重复调用 API
- 变更：默认模型由 `glm-4-flash` 更换为免费的 `glm-4.7-flash`
- 变更：移除译文 Markdown 的可信标记（`isTrusted`），避免模型输出命令链接注入风险；增加选中文本长度限制（5000 字符）

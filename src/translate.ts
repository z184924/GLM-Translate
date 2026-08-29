import * as vscode from "vscode";
import OpenAI from "openai";

let decorationType: vscode.TextEditorDecorationType | undefined;

let outputChannel: vscode.OutputChannel | undefined;

function log(message: string) {
    outputChannel ??= vscode.window.createOutputChannel("GLM-Translate");
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}

const MAX_TEXT_LENGTH = 5000;
const CACHE_LIMIT = 100;
const translationCache = new Map<string, string>();

// 进度通知只显示末尾一段文字，过长时保持最新内容可见
const PROGRESS_TAIL_CHARS = 200;
// UI 刷新节流间隔，避免每个网络分块都触发一次通知更新
const PROGRESS_INTERVAL_MS = 100;

// GLM 支持的思考级别（低版本 openai SDK 类型只包含 low/medium/high）
type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

function getConfig() {
    const config = vscode.workspace.getConfiguration("GLM-Translate");
    return {
        apiKey: config.get<string>("apiKey"),
        baseUrl: config.get<string>("baseUrl"),
        modelName: config.get<string>("modelName"),
        srcLanguage: config.get<string>("srcLanguage"),
        targetLanguage: config.get<string>("targetLanguage"),
        enableThinking: config.get<boolean>("enableThinking"),
        reasoningEffort: config.get<ReasoningEffort>("reasoningEffort"),
    };
}

function cachePut(key: string, value: string) {
    translationCache.set(key, value);
    if (translationCache.size > CACHE_LIMIT) {
        const oldest = translationCache.keys().next().value;
        if (oldest !== undefined) {
            translationCache.delete(oldest);
        }
    }
}

function progressMessage(streamed: string) {
    return streamed.length > PROGRESS_TAIL_CHARS
        ? `…${streamed.slice(-PROGRESS_TAIL_CHARS)}`
        : streamed;
}

export async function translateTextCommand() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const text = editor.document.getText(editor.selection);
    if (!text.trim()) return;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: true,
        },
        async (progress, token) => {
            const targetLanguage = getConfig().targetLanguage;
            progress.report({
                message: `Translating to "${targetLanguage}" ...`,
            });

            if (decorationType) {
                decorationType.dispose();
            }

            const abort = new AbortController();
            const subscription = token.onCancellationRequested(() => abort.abort());
            let lastReportAt = 0;
            let reportedThinking = false;
            let reportedText = false;

            try {
                const translatedText = await translate(text, {
                    signal: abort.signal,
                    // 流式阶段只显示纯文本进度，完成后才做 Markdown 渲染；
                    // 首个分块立即上报（通知创建初期的更新可能被吞），其后节流
                    onProgress: (kind, streamed) => {
                        if (kind === "thinking") {
                            if (reportedThinking) return;
                            reportedThinking = true;
                            progress.report({ message: "模型思考中..." });
                            return;
                        }
                        const now = Date.now();
                        if (reportedText && now - lastReportAt < PROGRESS_INTERVAL_MS) return;
                        reportedText = true;
                        lastReportAt = now;
                        progress.report({ message: progressMessage(streamed) });
                    },
                });

                if (!translatedText) return;

                const selection = editor.selection;
                const hoverMessage = new vscode.MarkdownString();
                hoverMessage.appendMarkdown(translatedText);

                const decoration: vscode.DecorationOptions = {
                    range: selection,
                    hoverMessage: hoverMessage,
                };

                decorationType = vscode.window.createTextEditorDecorationType({});
                editor.setDecorations(decorationType, [decoration]);

                await vscode.commands.executeCommand("editor.action.showHover");
            } finally {
                subscription.dispose();
            }
        }
    );
}

interface TranslateOptions {
    onProgress?: (kind: "thinking" | "text", streamed: string) => void;
    signal?: AbortSignal;
}

async function translate(text: string, opts?: TranslateOptions): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return "";

    const { apiKey, baseUrl, modelName, srcLanguage, targetLanguage, enableThinking, reasoningEffort } = getConfig();

    if (!apiKey) {
        vscode.window.showErrorMessage(
            "请先设置apiKey。(文件 -> 首选项 -> 设置 -> 扩展 -> GLM-Translate -> apiKey)"
        );
        return "";
    }

    if (trimmed.length > MAX_TEXT_LENGTH) {
        vscode.window.showWarningMessage(
            `选中文本过长（${trimmed.length} 字符，上限 ${MAX_TEXT_LENGTH}），已取消翻译`
        );
        return "";
    }

    const cacheKey = [baseUrl, modelName, srcLanguage, targetLanguage, enableThinking, reasoningEffort, trimmed].join("|");
    const cached = translationCache.get(cacheKey);
    if (cached !== undefined) {
        log("命中翻译缓存，直接返回");
        return cached;
    }

    const openai = new OpenAI({ baseURL: baseUrl, apiKey: apiKey });
    const startedAt = Date.now();
    log(`请求 ${modelName}（thinking ${enableThinking ? "enabled" : "disabled"}），文本 ${trimmed.length} 字符`);

    try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: `
                您是一位精通「${srcLanguage}」与「${targetLanguage}」的翻译专家。

                ## 翻译要求:
                1.忠实于"源文本"，确保每个句子都得到准确且流畅的翻译。
                2.大额数字的翻译需准确无误，符合「${targetLanguage}」的表达习惯。

                ##任务:
                1.仔细研究并深入理解"源文本"的内容、上下文、语境、情感以及和目标语言的文化细微差异。
                2."源文本"的部分单词可能是来源于代码，单词拼写形式可能是驼峰式，请根据上下文判断其含义，并翻译成目标语言。
                3.根据「翻译要求」将"源文本"准确翻译,返回结果为Markdown格式。
                4.确保翻译对目标受众来说准确、自然、流畅，必要时可以根据需要调整表达方式以符合文化和语言习惯。

                注意:不要输出任何额外的内容，只能输出翻译内容。这一点非常关键。
                `,
            },
            {
                role: "user",
                content: `
                源文本:
                """
                ${trimmed}
                """
                `,
            },
        ];
        // thinking 必须显式发送：GLM-4.7/5 系列默认开启思考，显式 disabled 才能保证默认关闭，
        // 不支持该参数的旧模型会忽略它；reasoning_effort 为顶层参数，仅 GLM-5.2+ 生效；
        // 思考开启时不设置采样参数（低温度与推理模式冲突）。
        // SDK 类型缺少 thinking，reasoning_effort 取值也比 GLM 的少，
        // 故按 GLM 语义构造请求，仅在调用 SDK 的边界断言回去
        const request: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, "reasoning_effort"> & {
            thinking?: { type: "enabled" | "disabled" };
            reasoning_effort?: ReasoningEffort | null;
        } = {
            model: modelName || "glm-4.7-flash",
            messages,
            stream: true,
            thinking: { type: enableThinking ? "enabled" : "disabled" },
            ...(enableThinking
                ? { reasoning_effort: reasoningEffort || "low" }
                : { top_p: 0.7, temperature: 0.25 }),
        };
        const stream = await openai.chat.completions.create(
            request as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
            opts?.signal ? { signal: opts.signal } : undefined
        );
        let result = "";
        let chunkCount = 0;
        let firstChunkAt = 0;
        let sawReasoning = false;
        for await (const chunk of stream) {
            // GLM 思考分块在 reasoning_content（SDK 类型未包含），译文分块在 content
            const delta = chunk.choices[0]?.delta as
                | { content?: string | null; reasoning_content?: string | null }
                | undefined;
            if (delta?.reasoning_content) {
                if (!sawReasoning) {
                    sawReasoning = true;
                    log(`收到首个思考分块（+${Date.now() - startedAt}ms）`);
                }
                opts?.onProgress?.("thinking", "");
            }
            if (delta?.content) {
                chunkCount++;
                if (!firstChunkAt) {
                    firstChunkAt = Date.now();
                    log(`收到首个译文分块（+${firstChunkAt - startedAt}ms）`);
                }
                result += delta.content;
                opts?.onProgress?.("text", result);
            }
        }
        log(`翻译完成：${chunkCount} 个译文分块，${result.length} 字符，总耗时 ${Date.now() - startedAt}ms`);
        const finalText = result || "Translation failed: received empty content";
        cachePut(cacheKey, finalText);
        return finalText;
    } catch (error) {
        // 用户主动取消时静默返回，不弹错误提示
        if (opts?.signal?.aborted) {
            log("已取消翻译");
            return "";
        }
        log(`翻译出错: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(
            `翻译失败: ${error instanceof Error ? error.message : String(error)}`
        );
        return "";
    }
}

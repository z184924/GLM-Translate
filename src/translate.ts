import * as vscode from "vscode";
import OpenAI from "openai";

let decorationType: vscode.TextEditorDecorationType | undefined;

const MAX_TEXT_LENGTH = 5000;
const CACHE_LIMIT = 100;
const translationCache = new Map<string, string>();

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

export async function translateTextCommand() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

    const text = editor.document.getText(editor.selection);
    if (!text.trim()) return;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
        },
        async (progress) => {
            const targetLanguage = getConfig().targetLanguage;
            progress.report({
                message: `Translating to "${targetLanguage}" ...`,
            });

            if (decorationType) {
                decorationType.dispose();
            }

            const selection = editor.selection;
            const translatedText = await translate(text);

            if (!translatedText) return;

            const hoverMessage = new vscode.MarkdownString();
            hoverMessage.appendMarkdown(translatedText);

            const decoration: vscode.DecorationOptions = {
                range: selection,
                hoverMessage: hoverMessage,
            };

            decorationType = vscode.window.createTextEditorDecorationType({});
            editor.setDecorations(decorationType, [decoration]);

            await vscode.commands.executeCommand("editor.action.showHover");
        }
    );
}

async function translate(text: string): Promise<string> {
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
        return cached;
    }

    const openai = new OpenAI({ baseURL: baseUrl, apiKey: apiKey });

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
        const request: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "reasoning_effort"> & {
            thinking?: { type: "enabled" | "disabled" };
            reasoning_effort?: ReasoningEffort | null;
        } = {
            model: modelName || "glm-4.7-flash",
            messages,
            thinking: { type: enableThinking ? "enabled" : "disabled" },
            ...(enableThinking
                ? { reasoning_effort: reasoningEffort || "low" }
                : { top_p: 0.7, temperature: 0.25 }),
        };
        const completion = await openai.chat.completions.create(
            request as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
        );
        const content = completion.choices[0].message.content;
        const result = content !== null
            ? content
            : "Translation failed: received null content";
        cachePut(cacheKey, result);
        return result;
    } catch (error) {
        vscode.window.showErrorMessage(
            `翻译失败: ${error instanceof Error ? error.message : String(error)}`
        );
        return "";
    }
}

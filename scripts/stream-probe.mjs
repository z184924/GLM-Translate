// 流式到达时序诊断脚本：完全绕开 VSCode 扩展环境，在纯 Node 中
// 用与插件相同的请求参数直连 GLM，逐块打印到达时间。
//
// 用法（在仓库根目录执行）:
//   node scripts/stream-probe.mjs <你的API_KEY> [模型名，默认glm-4.7-flash] [thinking on|off，默认off]
//
// 结果解读:
//   - 首块延迟小、块间隔均匀       -> API 正常流式，慢在 VSCode 环境（代理/fetch 拦截）
//   - 首块延迟 = 总耗时（块集中末尾)-> 网络层把 SSE 整段缓冲了
//   - 首块延迟本身就很大            -> 模型/服务端排队慢（TTFT 高）

import OpenAI from "openai";

const [apiKey, modelArg, thinkingArg] = process.argv.slice(2);
if (!apiKey) {
    console.error("用法: node scripts/stream-probe.mjs <apiKey> [model] [thinking on|off]");
    process.exit(1);
}

const model = modelArg || "glm-4.7-flash";
const enableThinking = thinkingArg === "on";
const text = "Machine learning is a branch of artificial intelligence that focuses on building systems that learn from and improve from data, and it has become an important part of many modern software applications.";

const openai = new OpenAI({
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
    apiKey,
});

const started = Date.now();
console.log(`模型: ${model}  thinking: ${enableThinking ? "enabled" : "disabled"}  文本 ${text.length} 字符`);
console.log("请求已发出，等待分块...\n");

const stream = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [
        {
            role: "system",
            content: `您是一位精通「英文」与「中文」的翻译专家。注意:不要输出任何额外的内容，只能输出翻译内容。`,
        },
        { role: "user", content: `源文本:\n"""\n${text}\n"""` },
    ],
    thinking: { type: enableThinking ? "enabled" : "disabled" },
    ...(enableThinking ? {} : { top_p: 0.7, temperature: 0.25 }),
});

let chunkCount = 0;
let firstAt = 0;
let reasoningChunks = 0;
let result = "";
for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta ?? {};
    if (delta.reasoning_content) {
        reasoningChunks++;
        if (reasoningChunks === 1) {
            console.log(`[+${Date.now() - started}ms] 首个思考分块`);
        }
        continue;
    }
    if (delta.content) {
        chunkCount++;
        if (!firstAt) {
            firstAt = Date.now() - started;
            console.log(`[+${firstAt}ms] 首个译文分块`);
        }
        result += delta.content;
        if (chunkCount <= 5 || chunkCount % 10 === 0) {
            console.log(`[+${Date.now() - started}ms] 分块#${chunkCount}: "${delta.content}"`);
        }
    }
}

console.log("\n===== 汇总 =====");
console.log(`思考分块: ${reasoningChunks} 个`);
console.log(`译文分块: ${chunkCount} 个，共 ${result.length} 字符`);
console.log(`首块延迟: ${firstAt}ms，总耗时: ${Date.now() - started}ms`);
console.log(`译文: ${result}`);

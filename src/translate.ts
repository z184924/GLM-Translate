import * as vscode from "vscode";
import OpenAI from "openai";

let decorationType: vscode.TextEditorDecorationType | undefined;

export async function translateTextCommand() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) return;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
    },
    async (progress) => {
      const targetLanguage = vscode.workspace
        .getConfiguration("GLM-Translate")
        .get("targetLanguage");
      progress.report({
        message: `Translating to "${targetLanguage}" ...`,
      });

      if (decorationType) {
        decorationType.dispose();
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      // 调用翻译 API 或者你自定义的翻译功能
      const translatedText = await translate(text);

      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.appendMarkdown(translatedText);
      hoverMessage.isTrusted = true;

      const decoration: vscode.DecorationOptions = {
        range: selection,
        hoverMessage: hoverMessage,
      };

      decorationType = vscode.window.createTextEditorDecorationType({});
      editor.setDecorations(decorationType, [decoration]);

      const position = editor.selection.active;
      await vscode.commands.executeCommand("editor.action.showHover",position);
    }
  );
}
export async function translate(text: string): Promise<string> {
  const vscode = require("vscode");

  function getConfig() {
    return vscode.workspace.getConfiguration("GLM-Translate");
  }

  let apiKey = getConfig().get("apiKey");
  let srcLanguage = getConfig().get("srcLanguage");
  let targetLanguage = getConfig().get("targetLanguage");
  let baseUrl = getConfig().get("baseUrl");
  let modelName = getConfig().get("modelName");

  if (!apiKey) {
    vscode.window.showErrorMessage(
      "请先设置apiKey。(文件 -> 首选项 -> 设置 -> 扩展 -> GLM-Translate -> apiKey)"
    );
    return "";
  }

  const openai = new OpenAI({ baseURL: baseUrl, apiKey: apiKey });

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: `
                您是一位精通「${srcLanguage}」与「${targetLanguage}」的翻译专家。
                
                ## 翻译要求:
                1.忠实于"源文本"，确保每个句子都得到准确且流畅的翻译。
                2.大额数字的翻译需准确无误，符合简体中文的表达习惯。

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
                源本文:
                """ 
                ${text} 
                """ 
                `,
      },
    ],
    top_p: 0.7,
    temperature: 0.25,
  });
  const content = completion.choices[0].message.content;
  return content !== null
    ? content
    : "Translation failed: received null content";
}

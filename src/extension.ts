// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { translate, translateTextCommand, decorationType, buttonFlag } from './translate';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "GLM-Translate" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const disposable = vscode.commands.registerCommand('GLM-Translate.translateText', translateTextCommand);
	context.subscriptions.push(disposable);

	// 注册 HoverProvider
	const hoverProvider = vscode.languages.registerHoverProvider('*', {
		provideHover: async (document, position, token) => {
			const editor = vscode.window.activeTextEditor;
			const selection = editor?.selection;
			// No open text editor or no selection
			if (!editor || !selection || !selection.contains(position) || buttonFlag) return;
			const text = editor.document.getText(selection);
			if (text) {
				if (decorationType) {
					decorationType.dispose();
				}
				let translatedText = await translate(text);
				const markdownString = new vscode.MarkdownString();
				markdownString.appendMarkdown(
					`
					"""
					${translatedText}
					"""
					`
				);
				markdownString.supportHtml = true;
				markdownString.isTrusted = true;
				return new vscode.Hover(translatedText);
			}
		}
	});

}

// This method is called when your extension is deactivated
export function deactivate() { }

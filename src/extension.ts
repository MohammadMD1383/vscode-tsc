import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as sm from "source-map";
import { compileTsText, compileTsTextWithSourceMap, getJsFileName } from "./util/typescriptHelper";
import { getFileUri, getThemeName } from "./util/util";
import ts = require("typescript");

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("vscode-tsc.compileCurrentSingleFile", async () => {
			const quickPickList: Array<vscode.QuickPickItem> = [
				{ label: "Live View", detail: "See live compiled code as you edit in a separate window" },
				{ label: "Compile To Output", detail: "Compiles current file to output window" },
				{ label: "Compile Across Current File", detail: "Compiles and saves to a new file next to this file" },
				{ label: "Compile To File...", detail: "Compiles to a file provided by you" },
			];

			const selection = await vscode.window.showQuickPick(quickPickList, {
				title: "Compile Current File",
				placeHolder: "Choose where to compile",
				canPickMany: false,
			});

			if (!selection) return;

			const isUntitled = vscode.window.activeTextEditor!.document.isUntitled;
			let fileName = vscode.window.activeTextEditor!.document.fileName;
			if (!isUntitled) fileName = path.basename(vscode.window.activeTextEditor!.document.fileName);

			switch (selection.label) {
				case quickPickList[0].label: // live compile
					const liveViewWebView = vscode.window.createWebviewPanel(
						`live-view`,
						`Live View: ${fileName}`,
						{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
						{ enableScripts: true }
					);
					const htmlPath = path.join(context.extensionPath, "res/html/LiveView.html");
					const script1Path = liveViewWebView.webview.asWebviewUri(getFileUri(context, "res/dist/highlight.min.js"));
					const script2Path = liveViewWebView.webview.asWebviewUri(getFileUri(context, "res/dist/javascript.min.js"));
					const stylePath = liveViewWebView.webview.asWebviewUri(getFileUri(context, `res/dist/styles/${getThemeName()}.min.css`));

					let htmlFileContent = fs.readFileSync(htmlPath, { encoding: "utf8" });
					htmlFileContent = htmlFileContent.replace("{{script1}}", script1Path.toString());
					htmlFileContent = htmlFileContent.replace("{{script2}}", script2Path.toString());
					htmlFileContent = htmlFileContent.replace("{{style}}", stylePath.toString());
					liveViewWebView.webview.html = htmlFileContent;

					let compiledCode: ts.TranspileOutput = compileTsTextWithSourceMap(vscode.window.activeTextEditor!.document.getText());
					liveViewWebView.webview.postMessage({
						kind: "code",
						code: compiledCode.outputText,
					});

					const textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
						if (event.document !== vscode.window.activeTextEditor?.document || event.document.languageId !== "typescript") {
							liveViewWebView.dispose();
							return;
						}

						compiledCode = compileTsTextWithSourceMap(event.document.getText());

						try {
							liveViewWebView.webview.postMessage({
								kind: "code",
								code: compiledCode.outputText,
							});
						} catch {
							textChangeListener.dispose();
						}
					});

					const cursorMoveListener = vscode.window.onDidChangeTextEditorSelection(async (event) => {
						if (event.textEditor.document !== vscode.window.activeTextEditor!.document) return;

						const sel = await sm.SourceMapConsumer.with(JSON.parse(compiledCode.sourceMapText!), null, (consumer) => {
							return consumer.generatedPositionFor({
								source: "module.ts",
								line: vscode.window.activeTextEditor!.selection.active.line + 1,
								column: vscode.window.activeTextEditor!.selection.active.character,
							});
						});

						try {
							liveViewWebView.webview.postMessage({
								kind: "highlight",
								highlight: sel,
							});
						} catch {
							cursorMoveListener.dispose();
						}
					});
					break;

				case quickPickList[1].label: // compile to output
					const compileOutputChannel = vscode.window.createOutputChannel(`TSC: ${fileName}`);

					vscode.window
						.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								cancellable: false,
								title: "Compiling...",
							},
							() => {
								compileOutputChannel.append(compileTsText(vscode.window.activeTextEditor!.document.getText()));
								return new Promise<void>((resolve) => resolve());
							}
						)
						.then(() => {
							compileOutputChannel.show();
						});
					break;

				case quickPickList[2].label: // compile across current file
					if (isUntitled) {
						vscode.window.showWarningMessage("Please save this file before using this action.");
						return;
					}
					if (vscode.window.activeTextEditor!.document.isDirty) await vscode.window.activeTextEditor!.document.save();

					fileName = path.basename(vscode.window.activeTextEditor!.document.fileName);
					const filePath = vscode.window.activeTextEditor!.document.uri.fsPath;
					const newFilePath = getJsFileName(filePath);

					vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							cancellable: false,
							title: "Compiling...",
						},
						() => {
							fs.writeFileSync(newFilePath, compileTsText(vscode.window.activeTextEditor!.document.getText()));
							return new Promise<void>((resolve) => resolve());
						}
					);
					break;

				case quickPickList[3].label: // compile to file...
					vscode.window.showSaveDialog({ filters: { javascript: ["js"] } }).then((uri: vscode.Uri | undefined) => {
						if (!uri) return;

						vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								cancellable: false,
								title: "Compiling...",
							},
							() => {
								fs.writeFileSync(uri.fsPath, compileTsText(vscode.window.activeTextEditor!.document.getText()));
								return new Promise<void>((resolve) => resolve());
							}
						);
					});
					break;
			}
		})
	);
}

export function deactivate() {}

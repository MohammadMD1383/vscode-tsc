import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as sm from "source-map";
import { transpileModule, TranspileOptions, TranspileOutput } from "typescript";
import {
	compileProject,
	compileTsText,
	compileTsTextWithSourceMap,
	destroyWatch,
	getActiveWatches,
	getJsFileName,
	readConfigFile,
	watchProject,
} from "./util/typescriptHelper";
import { checkForTsConfig, getFileUri, getThemeName } from "./util/util";

export async function activate(context: vscode.ExtensionContext) {
	// create `compile project` status bar icon
	if (vscode.workspace.name) {
		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 4);
		statusBarItem.command = "vscode-tsc.compileProject";
		statusBarItem.text = "$(zap) Compile Project";
		context.subscriptions.push(statusBarItem);

		checkForTsConfig(statusBarItem);

		const createFileListener = vscode.workspace.onDidCreateFiles(() => {
			checkForTsConfig(statusBarItem);
		});

		const deleteFileListener = vscode.workspace.onDidDeleteFiles(() => {
			checkForTsConfig(statusBarItem);
		});

		const renameFileListener = vscode.workspace.onDidRenameFiles(() => {
			checkForTsConfig(statusBarItem);
		});
	}

	// commands
	context.subscriptions.push(
		vscode.commands.registerCommand("vscode-tsc.compileCurrentSingleFile", async () => {
			const quickPickList: Array<vscode.QuickPickItem> = [
				{ label: "Live View", detail: "See live compiled code as you edit in a separate window" },
				{ label: "Compile To Output", detail: "Compiles current file to output window" },
				{ label: "Compile Across Current File", detail: "Compiles and saves to a new file next to this file" },
				{ label: "Compile To File...", detail: "Compiles to a file provided by you" },
			];

			const selection = await vscode.window.showQuickPick(quickPickList, {
				canPickMany: false,
				title: "Compile Current File",
				placeHolder: "Choose where to compile",
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

					let compiledCode: TranspileOutput = compileTsTextWithSourceMap(vscode.window.activeTextEditor!.document.getText());
					liveViewWebView.webview.postMessage({
						kind: "code",
						code: compiledCode.outputText,
					});

					// detect text change to trigger compile
					const textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
						if (event.document !== vscode.window.activeTextEditor?.document || event.document.languageId !== "typescript") {
							liveViewWebView.dispose();
							return;
						}

						compiledCode = compileTsTextWithSourceMap(event.document.getText());

						// dispose callback if webview is disposed
						try {
							liveViewWebView.webview.postMessage({
								kind: "code",
								code: compiledCode.outputText,
							});
						} catch {
							textChangeListener.dispose();
						}
					});

					// detect cursor change
					const cursorMoveListener = vscode.window.onDidChangeTextEditorSelection(async (event) => {
						if (event.textEditor.document !== vscode.window.activeTextEditor!.document) return;

						// get generated position for js from source map
						const sel = await sm.SourceMapConsumer.with(JSON.parse(compiledCode.sourceMapText!), null, (consumer) => {
							return consumer.generatedPositionFor({
								source: "module.ts",
								line: vscode.window.activeTextEditor!.selection.active.line + 1,
								column: vscode.window.activeTextEditor!.selection.active.character,
							});
						});

						// dispose callback if webview is disposed
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
		}),

		vscode.commands.registerCommand("vscode-tsc.compileProject", async () => {
			// find all tsconfig files in project
			const tsConfigFiles = (await vscode.workspace.findFiles("**/tsconfig.json")).map((uri) => {
				return uri.fsPath;
			});
			let tsConfigPath: string;

			// let user choose which one to compile
			if (tsConfigFiles.length > 1) {
				const items: Array<vscode.QuickPickItem> = tsConfigFiles.map((item, i) => {
					return {
						label: path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, item),
						description: i.toString(),
						detail: item,
					};
				});

				const selection = await vscode.window.showQuickPick(items, {
					canPickMany: false,
					title: "Compile Project",
					placeHolder: "Choose tsconfig root",
				});
				if (!selection) return;

				tsConfigPath = tsConfigFiles[+selection.description!];
			}
			// else is always `1`. because the availability of this command is to exist at least one tsconfig file
			else {
				tsConfigPath = tsConfigFiles[0];
			}

			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					cancellable: false,
				},
				async (progress) => {
					progress.report({ message: "Compiling...", increment: 33 });
					const tsSearchLocation = path.relative(
						vscode.workspace.workspaceFolders![0].uri.fsPath,
						path.join(path.dirname(tsConfigPath), "**/*.ts")
					);
					const tsFiles = (await vscode.workspace.findFiles(tsSearchLocation)).map((uri) => {
						return uri.fsPath;
					});

					const tsConfig = readConfigFile(tsConfigPath); // TODO: add support for include/exclude and others ...

					progress.report({ increment: 33 });
					compileProject(tsFiles, tsConfig);

					progress.report({ message: "Done!", increment: 34 });
					return new Promise<void>((resolve) => {
						setTimeout(() => {
							resolve();
						}, 1000);
					});
				}
			);
		}),

		vscode.commands.registerCommand("vscode-tsc.watchProject", ({ fsPath }: vscode.Uri) => {
			if (getActiveWatches().includes(fsPath)) {
				vscode.window.showWarningMessage("This file is already added to watches.");
				return;
			}

			watchProject(fsPath);
			vscode.window.showInformationMessage("File added to watches!");
		}),

		vscode.commands.registerCommand("vscode-tsc.showActiveWatches", () => {
			// @ts-ignore
			const _this = this as { outputChannel: vscode.OutputChannel };
			if (typeof _this.outputChannel === "undefined") _this.outputChannel = vscode.window.createOutputChannel("Project Watches");

			const activeWatches = getActiveWatches();

			_this.outputChannel.clear();
			if (activeWatches.length > 0) activeWatches.forEach((config) => _this.outputChannel.appendLine(config));
			else _this.outputChannel.appendLine("No Watch Available.");

			_this.outputChannel.show();
		}),

		vscode.commands.registerCommand("vscode-tsc.destroyWatch", async () => {
			const activeWatches = getActiveWatches();

			if (activeWatches.length > 0) {
				const rootDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
				const watchLabels = activeWatches.map((w) => path.relative(rootDir, w));
				const items = watchLabels.map((item, i) => {
					return {
						label: item,
						detail: activeWatches[i],
					} as vscode.QuickPickItem;
				});

				const selection = await vscode.window.showQuickPick(items, {
					canPickMany: false,
					placeHolder: "Choose watch to destroy",
					title: "Destroy Watch",
				});
				if (!selection) return;

				destroyWatch(selection.detail!);
				vscode.window.showInformationMessage("Watch destroyed.");
			} else {
				vscode.window.showInformationMessage("No active watches.");
			}
		}),

		// extension api
		// compiles typescript with given CompilerOptions and returns it
		vscode.commands.registerCommand(
			"vscode-tsc.api.transpileModule",
			(source: string, options: TranspileOptions): string => transpileModule(source, options).outputText
		)
	);
}

export function deactivate() {}

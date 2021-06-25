import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { compileTsText, getJsFileName } from "./util/typescriptHelper";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("vscode-tsc.compileCurrentSingleFile", async () => {
			const quickPickList: Array<vscode.QuickPickItem> = [
				{ label: "Compile to output", detail: "Compiles current file to output channel" },
				{ label: "Compile across current file", detail: "Compiles and saves to a new file next to this file" },
				{ label: "Compile to file...", detail: "Compiles to a file provided by you" },
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
				case quickPickList[0].label: // compile to output
					const outputChannel = vscode.window.createOutputChannel(`TSC: ${fileName}`);

					vscode.window
						.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								cancellable: false,
								title: "Compiling...",
							},
							() => {
								outputChannel.append(compileTsText(vscode.window.activeTextEditor!.document.getText()));
								return new Promise<void>((resolve) => resolve());
							}
						)
						.then(() => {
							outputChannel.show();
						});
					break;

				case quickPickList[1].label: // compile across current file
					if (isUntitled) {
						vscode.window.showWarningMessage("Please save this file before using this action.");
						return;
					}

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

				case quickPickList[2].label: // compile to file...
					vscode.window.showSaveDialog({ filters: { JavaScript: ["js"] } }).then((uri: vscode.Uri | undefined) => {
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

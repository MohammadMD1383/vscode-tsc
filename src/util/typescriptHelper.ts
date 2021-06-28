import { readFileSync } from "fs";
import { dirname, relative } from "path";
import {
	CompilerOptions,
	createProgram,
	createSemanticDiagnosticsBuilderProgram,
	createWatchCompilerHost,
	createWatchProgram,
	flattenDiagnosticMessageText,
	formatDiagnostic,
	getLineAndCharacterOfPosition,
	getPreEmitDiagnostics,
	parseConfigFileTextToJson,
	parseJsonConfigFileContent,
	SemanticDiagnosticsBuilderProgram,
	sys,
	transpileModule,
	TranspileOutput,
	WatchOfConfigFile,
} from "typescript";
import { OutputChannel, window, workspace } from "vscode";
import { getSingleFileCompilationCompilerOptions } from "./configurations";

export function compileTsText(tsText: string): string {
	return transpileModule(tsText, { compilerOptions: getSingleFileCompilationCompilerOptions() }).outputText;
}

export function compileTsTextWithSourceMap(tsText: string): TranspileOutput {
	return transpileModule(tsText, { compilerOptions: Object.assign(getSingleFileCompilationCompilerOptions(), { sourceMap: true }) });
}

export function getJsFileName(file: string) {
	let pos = file.lastIndexOf(".");
	return file.substr(0, pos < 0 ? file.length : pos) + ".js";
}

export function compileProject(fileNames: string[], options: CompilerOptions): void {
	// @ts-ignore
	const _this = compileProject as { outputChannel: OutputChannel };
	if (typeof _this.outputChannel === "undefined") _this.outputChannel = window.createOutputChannel(`TSC: ${workspace.name}`);

	_this.outputChannel.clear();

	let program = createProgram(fileNames, options);
	let emitResult = program.emit();

	let allDiagnostics = getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

	if (allDiagnostics.length > 0) {
		allDiagnostics.forEach((diagnostic) => {
			if (diagnostic.file) {
				let { line, character } = getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
				let message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
				_this.outputChannel.appendLine(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
			} else {
				_this.outputChannel.append(flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
			}
		});
	} else {
		_this.outputChannel.appendLine("No Problem Found.");
	}

	_this.outputChannel.show();
}

export function readConfigFile(configFileName: string): CompilerOptions {
	const configFileText = readFileSync(configFileName).toString();
	const result = parseConfigFileTextToJson(configFileName, configFileText);
	return parseJsonConfigFileContent(result.config, sys, dirname(configFileName)).options;
}

let watches: { [key: string]: { output: OutputChannel; program: WatchOfConfigFile<SemanticDiagnosticsBuilderProgram> } } = {};

export function watchProject(configPath: string) {
	if (watches.hasOwnProperty(configPath)) return;

	const host = createWatchCompilerHost(
		configPath,
		{},
		sys,
		createSemanticDiagnosticsBuilderProgram,
		(diagnostic) => {
			let { line, character } = getLineAndCharacterOfPosition(diagnostic.file!, diagnostic.start!);
			let message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
			watches[configPath].output.appendLine(`Error ${diagnostic.file!.fileName} (${line + 1},${character + 1}): ${message}`);
		},
		(diagnostic) => {
			watches[configPath].output.appendLine(
				formatDiagnostic(diagnostic, {
					getCanonicalFileName: (path) => path,
					getCurrentDirectory: sys.getCurrentDirectory,
					getNewLine: () => sys.newLine,
				})
			);
		}
	);

	watches[configPath] = {} as any;
	watches[configPath].output = window.createOutputChannel(`Watch: ${relative(workspace.workspaceFolders![0].uri.fsPath, configPath)}`);
	watches[configPath].program = createWatchProgram(host);
}

export function getActiveWatches() {
	return Object.keys(watches);
}

export function destroyWatch(configPath: string) {
	if (!watches.hasOwnProperty(configPath)) return;
	watches[configPath].program.close();
	watches[configPath].output.dispose();
	delete watches[configPath];
}

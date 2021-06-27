import { readFileSync } from "fs";
import { dirname, join } from "path";
import {
	CompilerOptions,
	createProgram,
	flattenDiagnosticMessageText,
	getLineAndCharacterOfPosition,
	getPreEmitDiagnostics,
	parseConfigFileTextToJson,
	parseJsonConfigFileContent,
	sys,
	transpileModule,
	TranspileOutput,
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

	if (typeof _this.outputChannel === "undefined") {
		_this.outputChannel = window.createOutputChannel(`TSC: ${workspace.name}`);
	}

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

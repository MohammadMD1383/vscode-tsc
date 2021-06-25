import * as vscode from "vscode";
import * as ts from "typescript";

const EXTENSION_NAME = "vscode-tsc";

interface ConfCompilerOptions {
	module: string;
	target: string;
	strict: boolean;
	removeComments: boolean;
}

export function getSingleFileCompilationCompilerOptions(): ts.CompilerOptions {
	const options = vscode.workspace.getConfiguration(EXTENSION_NAME).get("singleCompilationCompilerOptions") as ConfCompilerOptions;
	const compilerOptions: ts.CompilerOptions = {};

	compilerOptions.module = ts.ModuleKind[options.module];
	compilerOptions.target = ts.ScriptTarget[options.target];
	compilerOptions.strict = options.strict;
	compilerOptions.removeComments = options.removeComments;

	return compilerOptions;
}

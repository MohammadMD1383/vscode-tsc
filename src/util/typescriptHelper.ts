import { transpileModule } from "typescript";
import { getSingleFileCompilationCompilerOptions } from "./configurations";

export function compileTsText(tsText: string): string {
	return transpileModule(tsText, { compilerOptions: getSingleFileCompilationCompilerOptions() }).outputText;
}

export function getJsFileName(file: string) {
	let pos = file.lastIndexOf(".");
	return file.substr(0, pos < 0 ? file.length : pos) + ".js";
}

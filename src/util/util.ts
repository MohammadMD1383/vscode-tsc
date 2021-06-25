import { join } from "path";
import { ExtensionContext, Uri } from "vscode";

export function getFileUri(context: ExtensionContext, path: string) {
	return Uri.file(join(context.extensionPath, path));
}

import { join } from "path";
import { ColorThemeKind, commands, ExtensionContext, StatusBarItem, Uri, window, workspace } from "vscode";

export function getFileUri(context: ExtensionContext, path: string) {
	return Uri.file(join(context.extensionPath, path));
}

export function getThemeName() {
	switch (window.activeColorTheme.kind) {
		case ColorThemeKind.Dark:
			return "github-dark";
		case ColorThemeKind.Light:
			return "github";
		case ColorThemeKind.HighContrast:
			return "base16/windows-high-contrast";
	}
}

export async function checkForTsConfig(statusBarItem?: StatusBarItem): Promise<boolean> {
	const contains = (await workspace.findFiles("**/tsconfig.json")).length > 0;
	if (contains) {
		commands.executeCommand("setContext", "vscode-tsc.isTsProject", true);
		statusBarItem?.show();
	} else {
		commands.executeCommand("setContext", "vscode-tsc.isTsProject", false);
		statusBarItem?.hide();
	}
	return contains;
}

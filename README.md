# Visual Studio Code TypeScript Compiler

Compile typescript in visual studio code without need of installing **Node.js**

## Table Of Contents

-   [Features](#features)
-   [How To](#how-to)
-   [Configurations](#configurations)
-   [Extension API](#extension-api)
-   [Notice](#notice)
-   [Known Issues](#known-issues)

### Features

-   **Single Compilation**: compile any typescript file without need of being in a typescript project:
    -   see in vscode output
    -   compile it next to current typescript file
    -   compile it anywhere you want
-   **Live View**: see the compiled javascript next to typescript as you edit
-   **Compile Project**<sup>[\*](#reference)</sup>: compile a typescript project
-   **Watch Project**<sup>[\*](#reference)</sup>: use typescript `watch` feature to compile your project

### How To

**Single Compilation**-**Live View**:

1. open any `.ts` file
2. click the <img src="https://github.com/MohammadMD1383/vscode-tsc/blob/master/res/icon/compile-single-file/png/tsc-compile-single-file%40dark.png" alt="Image" width="15" style="vertical-align:middle;"> icon at top right of editor
3. choose the compilation mode

**Compile Project**:

1. open a vscode workspace(folder)
2. add a `tsconfig.json` file at the root of your typescript files
3. a status bar item appears (Compile Project)
4. click on that and your project will be compiled

**Watch Project**:

1. follow steps 1 and 2 of previous section
2. right click on `tsconfig.json` file
3. click _Watch Project_ and your project will be watched
    - open commands by pressing <kbd>F1</kbd>
        - **destroy watch**: destroys an active watch
        - **show active watches**: shows the current active watches

### Configurations

-   Single Compilation Configurations
    -   `vscode-tsc.singleCompilationCompilerOptions.module`
    -   `vscode-tsc.singleCompilationCompilerOptions.target`
    -   `vscode-tsc.singleCompilationCompilerOptions.strict`
    -   `vscode-tsc.singleCompilationCompilerOptions.removeComments`

### Extension API

This extension provides some commands that can be used by other extensions

Current Commands:

-   `vscode-tsc.api.transpileModule`
    -   parameters
        -   `string` source: typescript code
        -   `ts.TranspileOptions` options: options for compilation
    -   returns: `string`: compiled javascript

### Notice

-   for now only `CompilerOptions` in `tsconfig.json` is supported and other configurations will be ignored

### Known Issues

-   nothing yet!

---

<p id="reference">
*: needs <code>tsconfig.json</code> file to be in the root of typescript project
</p>

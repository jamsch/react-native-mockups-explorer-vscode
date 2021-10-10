// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MockupExplorerTree, log } from "./MockupExplorerTree";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const mockupExplorerTree = new MockupExplorerTree();

  vscode.window.registerTreeDataProvider("react-native-mockups-explorer.mockupExplorer", mockupExplorerTree);

  vscode.commands.registerCommand("react-native-mockups-explorer.reconnect", () => mockupExplorerTree.reconnect());

  vscode.commands.registerCommand("react-native-mockups-explorer.select", async (args) => {
    // Emit navigate
    mockupExplorerTree.navigate(args.mockup);

    const projectRoot = mockupExplorerTree.state?.projectRoot;

    if (!projectRoot) {
      log.appendLine(`No project root found. Skipping file navigation`);
      return;
    }

    // Open file
    const relativePath = args.mockup.path as string;

    // Combine project root with relative path, accounting for "../" and forward/backward slashes
    const basePath = vscode.Uri.parse(projectRoot);
    const fullPath = vscode.Uri.joinPath(basePath, relativePath)?.fsPath;
    // log.appendLine(`fullPath: ${fullPath}, relativePath: ${relativePath}`);

    const filePath = await (async () => {
      const regularFilePath = vscode.Uri.file(fullPath);
      // Check if file exists in workspace
      try {
        await vscode.workspace.fs.stat(regularFilePath);
        return regularFilePath;
      } catch (e) {
        log.appendLine(`File ${fullPath} does not exist. Falling back to remote.`);
      }

      // Fall back to remote file path
      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (workspace?.uri.scheme.includes("remote") || workspace?.uri.authority.includes("wsl")) {
        const { scheme, authority } = workspace.uri;
        return regularFilePath.with({ scheme, authority });
      }
    })();

    if (!filePath) {
      log.appendLine(`No suitable file path found`);
      return;
    }

    log.appendLine(`Opening file path ${JSON.stringify(filePath)}`);

    vscode.commands.executeCommand("vscode.open", filePath);

    /*
    vscode.workspace.openTextDocument(filePath).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
    */
  });

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("react-native-mockups-explorer.server_uri")) {
      mockupExplorerTree.reconnect();
    }
  });
  // context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

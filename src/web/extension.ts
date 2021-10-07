// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MockupExplorerTree } from "./MockupExplorerTree";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "react-native-mockups-explorer" is now active in the web extension host!'
  );

  const mockupExplorerTree = new MockupExplorerTree();

  vscode.window.registerTreeDataProvider("react-native-mockups-explorer.mockupExplorer", mockupExplorerTree);

  vscode.commands.registerCommand("react-native-mockups-explorer.reconnect", () => mockupExplorerTree.reconnect());

  vscode.commands.registerCommand("react-native-mockups-explorer.select", (args) => {
    // Emit navigate
    mockupExplorerTree.navigate(args.mockup);

    // Open file
    const path = args.mockup.path;
    vscode.commands.executeCommand("vscode.open", vscode.Uri.file(path));
    vscode.workspace.openTextDocument(path).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
  });

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("react-native-mockups-explorer.port")) {
      mockupExplorerTree.reconnect();
    }
  });
  // context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
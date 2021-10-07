import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

type Mockup = {
  title: string;
  path: string;
  children?: Mockup[];
};

type AppState = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  has_synced: boolean;
  path: string | null;
  mockups: Mockup[];
};
//Create output channel
let log = vscode.window.createOutputChannel("React Native Mockups Explorer");

export class MockupExplorerTree implements vscode.TreeDataProvider<MockupItem> {
  websocket: WebSocket;
  state: AppState | undefined;

  constructor() {
    this.websocket = this._createWebSocket();
  }

  reconnect() {
    this.websocket.close();
    this.websocket = this._createWebSocket();
  }

  private _createWebSocket(): WebSocket {
    const serverUri = vscode.workspace.getConfiguration("react-native-mockups-explorer").get("server_uri");
    const uri = `ws://${serverUri}/websocket`;
    log.appendLine(`Creating websocket connection for ${uri}`);
    const websocket = new WebSocket(uri);

    websocket.onopen = () => {
      log.appendLine("WebSocket connected");
      vscode.commands.executeCommand("setContext", "is-running-mockup-server", true);
      this.websocket.send(JSON.stringify({ type: "PING" }));
    };

    websocket.onerror = (error) => {
      log.appendLine(`WebSocket error: ${JSON.stringify(error)}`);
      vscode.window
        .showInformationMessage(`Lost connection to the mockup server at ${uri}`, "Reconnect")
        .then((value) => {
          if (value === "Reconnect") {
            this.reconnect();
          }
        });
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      log.appendLine(`Received message: ${message.type}`);
      switch (message.type) {
        case "SYNC_STATE":
          this.state = message.payload;
          break;
        case "NAVIGATE": {
          if (this.state) {
            this.state.path = message.path;
          }
          break;
        }
        default:
          return;
      }
      this.refresh();
    };

    return websocket;
  }

  navigate(element: Mockup): void {
    log.appendLine(`[navigate] called with ${element.path}`);
    if (this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: "NAVIGATE", payload: element.path }));
    }
  }

  getTreeItem(element: MockupItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MockupItem): Thenable<MockupItem[]> {
    log.appendLine(`getChildren called`);
    return new Promise((resolve) => {
      if (this.state) {
        log.appendLine(`mapping`);
        resolve(this.state.mockups.map((mockup) => new MockupItem(mockup, vscode.TreeItemCollapsibleState.None)));
        return;
      }

      const interval = setInterval(() => {
        log.appendLine(`waiting..`);
        if (this.state) {
          clearInterval(interval);
          resolve(this.state.mockups.map((mockup) => new MockupItem(mockup, vscode.TreeItemCollapsibleState.None)));
          return;
        }
      }, 1000);
    });
    //
  }

  private _onDidChangeTreeData: vscode.EventEmitter<MockupItem | undefined | null | void> = new vscode.EventEmitter<
    MockupItem | undefined | null | void
  >();

  readonly onDidChangeTreeData: vscode.Event<MockupItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

class MockupItem extends vscode.TreeItem {
  constructor(public readonly mockup: Mockup, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(mockup.title, collapsibleState);
    this.tooltip = mockup.title;
    // replace vs code workspace path with nothing
    const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(mockup.path))?.uri.toString() || "";
    this.description = (workspace && `[${workspace}] `) + mockup.path.replace(workspace, "");
    this.command = {
      command: "react-native-mockups-explorer.select",
      arguments: [this],
      title: "Select",
    };
  }
}
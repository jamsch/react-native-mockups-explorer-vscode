import * as vscode from "vscode";

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

export class MockupExplorerTree implements vscode.TreeDataProvider<MockupItem | ConnectItem> {
  websocket: WebSocket;
  state: AppState | undefined;

  constructor() {
    this.websocket = this._createWebSocket();
  }

  reconnect() {
    log.appendLine(`Attempting reconnection...`);
    // reassign onclose to avoid info message about lost connection
    this.websocket.onclose = () => {};
    this.websocket.close();
    this.websocket = this._createWebSocket();
    this.refresh();
  }

  private _createWebSocket(): WebSocket {
    const serverUri = vscode.workspace.getConfiguration("react-native-mockups-explorer").get("server_uri");
    const uri = `ws://${serverUri}/websocket`;
    log.appendLine(`Creating websocket connection for ${uri}`);
    const websocket = new WebSocket(uri);

    websocket.onopen = () => {
      log.appendLine("WebSocket connected");
      this.websocket.send(JSON.stringify({ type: "PING" }));
    };
    websocket.onclose = () => {
      vscode.window
        .showInformationMessage(`Lost connection to the mockup server at ${uri}`, "Reconnect")
        .then((value) => {
          if (value === "Reconnect") {
            this.reconnect();
          }
        });
    };
    websocket.onerror = (error) => {
      // Avoid chaining multiple info messages
      websocket.onclose = () => {};
      log.appendLine(`WebSocket error`);
      vscode.window
        .showInformationMessage(
          `Failed to connect to the mockup server at ${uri}. Please make sure that the mockup server is running.`,
          "Reconnect"
        )
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
    } else {
      log.appendLine(`[navigate] websocket not open (state: ${this.websocket.readyState})`);
      vscode.window
        .showInformationMessage(
          `Failed to connect to the mockup server. Please make sure that the mockup server is running.`,
          "Reconnect"
        )
        .then((value) => {
          if (value === "Reconnect") {
            this.reconnect();
          }
        });
    }
  }

  getTreeItem(element: MockupItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MockupItem): Thenable<MockupItem[] | ConnectItem[]> {
    log.appendLine(`getChildren called`);
    return new Promise((resolve) => {
      if (this.state) {
        resolve(this.state.mockups.map((mockup) => new MockupItem(mockup, vscode.TreeItemCollapsibleState.None)));
        return;
      }

      const interval = setInterval(() => {
        if (this.websocket.readyState === WebSocket.CLOSED) {
          clearInterval(interval);
          resolve([new ConnectItem()]);
          return;
        }

        log.appendLine(`Waiting..`);
        if (this.state) {
          clearInterval(interval);
          resolve(this.state.mockups.map((mockup) => new MockupItem(mockup, vscode.TreeItemCollapsibleState.None)));
          return;
        }
      }, 1000);
    });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<MockupItem | undefined | null | void> = new vscode.EventEmitter<
    MockupItem | undefined | null | void
  >();

  readonly onDidChangeTreeData: vscode.Event<MockupItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

class ConnectItem extends vscode.TreeItem {
  constructor() {
    super("Connect", vscode.TreeItemCollapsibleState.None);
    this.tooltip = "Attempts to connect to the mockup server";
    this.command = {
      command: "react-native-mockups-explorer.reconnect",
      title: "Connect",
    };
  }
}

class MockupItem extends vscode.TreeItem {
  constructor(public readonly mockup: Mockup, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(mockup.title, collapsibleState);
    this.tooltip = mockup.title;
    // replace vs code workspace path with nothing
    const workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(mockup.path))?.uri.toString() || "";
    this.description = workspace ? mockup.path.replace(workspace.replace("file://", ""), ".") : mockup.path;
    this.command = {
      command: "react-native-mockups-explorer.select",
      arguments: [this],
      title: "Select",
    };
  }
}

"use strict";

import * as fsExtra from "fs-extra";
import * as ost from "os";
import * as path from "path";
import { clearInterval, setInterval } from "timers";
import * as vscode from "vscode";
import { MessageItem, Terminal } from "vscode";
import * as ws from "ws";
import { AzureAccount, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole, OSes } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { aciConfig, Constants, exportContainerCmd, exportTestScript } from "./constants";
import { azFileDelete, azFilePush, escapeFile, TerminalType, TFTerminal } from "./shared";

const tempFile = path.join(ost.tmpdir(), "cloudshell" + vscode.env.sessionId + ".log");

export class CloudShell extends BaseShell {

    protected csTerm = new TFTerminal(
        TerminalType.CloudShell,
        Constants.TerraformTerminalName);

    public async pushFiles(files: vscode.Uri[], syncAllFiles: boolean) {
        this.outputChannel.appendLine("Attempting to upload files to CloudShell");
        const RETRY_INTERVAL = 500;
        const RETRY_TIMES = 30;

        // Checking if the terminal has been created and user is logged in.
        if (!await this.terminalInitialized()) {
            return;
        }

        for (let i = 0; i < RETRY_TIMES; i++) {
            if (this.csTerm.ws.readyState !== ws.OPEN) {
                // wait for valid ws connection
                await delay(RETRY_INTERVAL);
            } else {
                for (const file of files.map((a) => a.fsPath)) {
                    try {
                        if (await fsExtra.pathExists(file)) {
                            this.outputChannel.appendLine(`Uploading file ${file} to cloud shell`);
                            await azFilePush(this.csTerm.storageAccountName,
                                this.csTerm.storageAccountKey,
                                this.csTerm.fileShareName, file);
                        }
                    } catch (err) {
                        this.outputChannel.appendLine(err);
                    }
                }

                if (syncAllFiles) {
                    vscode.window.showInformationMessage(
                        "Synced all matched files in the current workspace to CloudShell");
                }
                break;
            }
        }
    }

    public async pullFiles(files: vscode.Uri[]) {
        return;
    }

    public async deleteFiles(files: vscode.Uri[]) {
        const RETRY_INTERVAL = 500;
        const RETRY_TIMES = 3;

        // Checking if the terminal has been created and user is logged in.
        if (!await this.terminalInitialized()) {
            return;
        }

        for (let i = 0; i < RETRY_TIMES; i++) {
            if (this.csTerm.ws.readyState !== ws.OPEN) {
                // wait for valid ws connection
                await delay(RETRY_INTERVAL);
            } else {
                for (const file of files.map((a) => a.fsPath)) {
                    try {
                        this.outputChannel.appendLine(`Deleting file ${file} from cloud shell`);
                        await azFileDelete(this.csTerm.storageAccountName,
                            this.csTerm.storageAccountKey,
                            this.csTerm.fileShareName, file);
                    } catch (err) {
                        this.outputChannel.appendLine(err);
                    }
                }
            }
        }
    }

    protected runTerraformInternal(TFCommand: string, WorkDir: string) {
        // Workaround the TLS error
        /* tslint:disable:no-string-literal */
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
        /* tslint:enable:no-string-literal */

        // TODO: Check if logged with azure account
        if (this.csTerm.terminal == null) {
            this.startCloudShell().then((terminal) => {
                this.csTerm.terminal = terminal[0];
                this.csTerm.ws = terminal[1];
                this.csTerm.storageAccountName = terminal[2];
                this.csTerm.storageAccountKey = terminal[3];
                this.csTerm.fileShareName = terminal[4];
                this.csTerm.ResourceGroup = terminal[5];
                this.runTFCommand(TFCommand, WorkDir, this.csTerm.terminal);
            });
        } else {
            this.runTFCommand(TFCommand, WorkDir, this.csTerm.terminal);
        }

    }

    protected initShellInternal() {
        // Reacting to the deletion of the terminal window
        if ("onDidCloseTerminal" in vscode.window as any) {
            (vscode.window as any).onDidCloseTerminal((terminal) => {
                if (terminal === this.csTerm.terminal) {
                    this.outputLine("\nTerraform CloudShell Term closed", terminal.name);
                    this.outputChannel.appendLine("CloudShell terminal was closed");
                    fsExtra.removeSync(tempFile);
                    this.csTerm.terminal = null;
                }
            });
        }

        // Reacting to the deletion of a file in the workspace
        if ("onDidCloseTextDocument" in vscode.workspace as any) {
            (vscode.workspace as any).onDidCloseTextDocument((textDocument) => {
                this.outputChannel.appendLine(`Document closed ${textDocument.fileName}`);
                // File deleted let"s sync the workspace
                // TODO: Implement logic to handle deleted files
            });
        }

    }

    protected async syncWorkspaceInternal(file) {
        this.outputChannel.appendLine(`Deleting ${path.basename(file)} in CloudShell`);
        const retryInterval = 500;
        const retryTimes = 30;

        // Checking if the terminal has been created
        if (this.csTerm.terminal != null) {
            for (let i = 0; i < retryTimes; i++) {
                if (this.csTerm.ws.readyState !== ws.OPEN) {
                    await delay(retryInterval);
                } else {
                    try {
                        this.csTerm.ws.send("rm " + path.relative(vscode.workspace.rootPath, file) + " \n");
                        // TODO: Add directory management
                    } catch (err) {
                        this.outputChannel.appendLine(err);
                    }
                    break;
                }
            }
        } else {
            vscode.window.showErrorMessage("Open a terminal first");
            this.outputChannel.appendLine("Terminal not opened when trying to transfer files");
        }
    }

    protected async runTerraformTestsInternal(TestType: string) {
        if ((this.csTerm.terminal != null) && (this.csTerm.storageAccountKey != null)) {
            const cloudDrivePath = `${vscode.workspace.name}${path.sep}.TFTesting`;
            const localPath = vscode.workspace.workspaceFolders[0].uri.fsPath + path.sep + ".TFTesting";
            const createAciScript = "createacitest.sh";

            // TestType: lint, e2e - no ssh, e2e - with ssh, custom
            const testCommand = {
                "lint": `rake -f ../../Rakefile build`,
                "e2e - no ssh": `rake -f ../../Rakefile e2e`,
                "e2e - with ssh": `rake -f ../../Rakefile e2e`,
                "custom": "", // TODO: Implement the custom command in CloudShell
            };

            const TFConfiguration = escapeFile(aciConfig(vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup"),
                vscode.workspace.getConfiguration("tf-azure").get("aci-name"),
                vscode.workspace.getConfiguration("tf-azure").get("aci-group"),
                this.csTerm.storageAccountName, this.csTerm.fileShareName,
                vscode.workspace.getConfiguration("tf-azure").get("test-location"),
                vscode.workspace.getConfiguration("tf-azure").get("test-container"), `${vscode.workspace.name}`));

            // Writing the TF Configuration file on local drive
            console.log("Writing TF Configuration for ACI");
            const shellscript = exportTestScript("lint", TFConfiguration, this.csTerm.ResourceGroup, this.csTerm.storageAccountName, this.csTerm.fileShareName, cloudDrivePath);
            await fsExtra.outputFile(localPath + path.sep + "createacitest.sh", shellscript, (err) => {
                console.log("Write ACI TF Configuration file done");
            });

            // copy the file to CloudDrive
            azFilePush(this.csTerm.storageAccountName, this.csTerm.storageAccountKey, this.csTerm.fileShareName, localPath + path.sep + createAciScript);

            // Write the container shell script
            console.log("Writing the Container command script");
            await fsExtra.outputFile(localPath + path.sep + "containercmd.sh", exportContainerCmd(`${vscode.workspace.name}`, testCommand[TestType]), (err) => {
                console.log("Write container command script done");
            });

            // copy the file to CloudDrive
            azFilePush(this.csTerm.storageAccountName, this.csTerm.storageAccountKey, this.csTerm.fileShareName, localPath + path.sep + "containercmd.sh");

            // Run the shell script
            this.runTFCommand(`cd ~/clouddrive/${cloudDrivePath} && source ${createAciScript} && terraform fmt && terraform init && terraform apply -auto-approve && terraform taint azurerm_container_group.TFTest && \
                               echo "\nRun the following command to get the logs from the ACI container: az container logs -g ${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")} -n ${vscode.workspace.getConfiguration("tf-azure").get("aci-name")}\n"`, cloudDrivePath, this.csTerm.terminal);
            vscode.window.showInformationMessage(`An Azure Container Instance has been created in the Resource Group - ${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")}\nDelete this resource to stop the associated costs`);

        } else {
            const message = "A CloudShell session is needed, do you want to open CloudShell?";
            const ok: MessageItem = { title: "Yes" };
            const cancel: MessageItem = { title: "No", isCloseAffordance: true };
            vscode.window.showWarningMessage(message, ok, cancel).then((response) => {
                if (response === ok) {
                    this.startCloudShell().then((terminal) => {
                        this.csTerm.terminal = terminal[0];
                        this.csTerm.ws = terminal[1];
                        this.csTerm.storageAccountName = terminal[2];
                        this.csTerm.storageAccountKey = terminal[3];
                        this.csTerm.fileShareName = terminal[4];
                        this.csTerm.ResourceGroup = terminal[5];
                        console.log(`Obtained terminal and fileshare data\n`);
                        this.runTerraformTestsInternal(TestType);
                        return;
                    });
                }
            });
            console.log("Terminal not opened when trying to transfer files");
        }

    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): Promise<any> {
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions
            .getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        const azureSubscription: AzureSubscription = vscode.extensions
            .getExtension<AzureSubscription>("ms-vscode.azure-account")!.exports;

        let iTerm;

        const os = process.platform === "win32" ? OSes.Windows : OSes.Linux;
        await openCloudConsole(accountAPI, azureSubscription, os, this.outputChannel, tempFile).then((terminal) => {

            // This is where we send the text to the terminal
            this.outputChannel.appendLine("Terminal obtained - moving on to running a command");
            iTerm = terminal;
        });
        this.outputChannel.appendLine("\nEnd of the startCloudShell() - iTerm returned");
        return iTerm;
    }

    protected runTFCommand(command: string, workdir: string, terminal: Terminal) {
        this.outputChannel.appendLine("Runing a command in an existing terminal ");
        let count = 30;
        if (terminal) {
            const localThis = this;
            const interval = setInterval(() => {
                count--;
                this.outputChannel.appendLine(count.toString());
                if (count > 0) {
                    if (fsExtra.existsSync(tempFile)) {
                        this.outputChannel.appendLine(`\nSending command: ${command}`);
                        terminal.sendText(`${command}`);
                        terminal.show();

                        count = 0;
                    }
                } else {
                    localThis.stop(interval);
                }
            }, 500);
        } else {
            this.outputChannel.appendLine("\nConnecting to terminal failed, please retry.");
        }

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

    private terminalInitialized(): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            if ((this.csTerm.terminal !== null) && (this.csTerm.storageAccountKey !== undefined)) {
                resolve(true);
            } else {
                const message = "Do you want to open CloudShell?";
                const ok: MessageItem = { title: "Yes" };
                const cancel: MessageItem = { title: "No", isCloseAffordance: true };
                const response: MessageItem = await vscode.window.showWarningMessage(message, ok, cancel);
                if (response === ok) {
                    const terminal: Terminal = await this.startCloudShell();
                    this.csTerm.terminal = terminal[0];
                    this.csTerm.ws = terminal[1];
                    this.csTerm.storageAccountName = terminal[2];
                    this.csTerm.storageAccountKey = terminal[3];
                    this.csTerm.fileShareName = terminal[4];
                    this.csTerm.ResourceGroup = terminal[5];
                    this.outputChannel.appendLine("Obtained cloudshell terminal, retrying push files.");
                    resolve(true);
                } else {
                    console.log("Open CloudShell cancelled by user.");
                    resolve(false);
                }
            }
        });
    }
}

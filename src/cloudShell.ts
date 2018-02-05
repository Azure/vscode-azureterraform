"use strict";

import * as fsExtra from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem, Terminal } from "vscode";
import * as ws from "ws";
import { AzureAccount, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole, OSes } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { aciConfig, Constants, exportContainerCmd, exportTestScript } from "./constants";
import { azFileDelete, azFilePush, escapeFile, TerminalType, TestOption, TFTerminal } from "./shared";
import { terraformChannel } from "./terraformChannel";
import { DialogOption } from "./utils/uiUtils";

const tempFile = path.join(os.tmpdir(), "cloudshell" + vscode.env.sessionId + ".log");

export class CloudShell extends BaseShell {

    public async pushFiles(files: vscode.Uri[], syncAllFiles: boolean): Promise<void> {
        terraformChannel.appendLine("Attempting to upload files to CloudShell");
        const RETRY_INTERVAL = 500;
        const RETRY_TIMES = 30;

        // Checking if the terminal has been created and user is logged in.
        if (!await this.terminalInitialized()) {
            return;
        }

        for (let i = 0; i < RETRY_TIMES; i++) {
            if (this.tfTerminal.ws.readyState !== ws.OPEN) {
                // wait for valid ws connection
                await delay(RETRY_INTERVAL);
            } else {
                for (const file of files.map((a) => a.fsPath)) {
                    try {
                        if (await fsExtra.pathExists(file)) {
                            terraformChannel.appendLine(`Uploading file ${file} to cloud shell`);
                            await azFilePush(
                                vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file)).name,
                                this.tfTerminal.storageAccountName,
                                this.tfTerminal.storageAccountKey,
                                this.tfTerminal.fileShareName, file);
                        }
                    } catch (err) {
                        terraformChannel.appendLine(err);
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

    public async deleteFiles(files: vscode.Uri[]): Promise<void> {
        const RETRY_INTERVAL = 500;
        const RETRY_TIMES = 3;

        // Checking if the terminal has been created and user is logged in.
        if (!await this.terminalInitialized()) {
            return;
        }

        for (let i = 0; i < RETRY_TIMES; i++) {
            if (this.tfTerminal.ws.readyState !== ws.OPEN) {
                // wait for valid ws connection
                await delay(RETRY_INTERVAL);
            } else {
                for (const file of files.map((a) => a.fsPath)) {
                    try {
                        terraformChannel.appendLine(`Deleting file ${file} from cloud shell`);
                        await azFileDelete(
                            vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file)).name,
                            this.tfTerminal.storageAccountName,
                            this.tfTerminal.storageAccountKey,
                            this.tfTerminal.fileShareName, file);
                    } catch (err) {
                        terraformChannel.appendLine(err);
                    }
                }
            }
        }
    }

    public async runTerraformTests(testType: string, workingDirectory: string) {
        if ((this.tfTerminal.terminal != null) && (this.tfTerminal.storageAccountKey != null)) {
            const workspaceName: string = path.basename(workingDirectory);
            const cloudDrivePath: string = `${workspaceName}/.TFTesting`;
            const localPath: string = path.join(workingDirectory, ".TFTesting");
            const CREATE_ACI_SCRIPT: string = "createacitest.sh";
            const CONTAINER_CMD_SCRIPT: string = "containercmd.sh";

            const TFConfiguration = escapeFile(aciConfig(
                    vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup"),
                    vscode.workspace.getConfiguration("tf-azure").get("aci-name"),
                    vscode.workspace.getConfiguration("tf-azure").get("aci-group"),
                    this.tfTerminal.storageAccountName, this.tfTerminal.fileShareName,
                    vscode.workspace.getConfiguration("tf-azure").get("test-location"),
                    vscode.workspace.getConfiguration("tf-azure").get("test-container"),
                    workspaceName,
            ));

            const shellscript = exportTestScript("lint", TFConfiguration, this.tfTerminal.ResourceGroup, this.tfTerminal.storageAccountName, this.tfTerminal.fileShareName, cloudDrivePath);

            console.log("Wrting scripts for e2e test");
            await Promise.all([
                fsExtra.outputFile(path.join(localPath, CREATE_ACI_SCRIPT), shellscript),
                fsExtra.outputFile(path.join(localPath, CONTAINER_CMD_SCRIPT), exportContainerCmd(workspaceName, await this.resolveContainerCmd(testType))),
            ]);

            console.log("Push scripts to cloudshell");
            await Promise.all([
                azFilePush(workspaceName, this.tfTerminal.storageAccountName, this.tfTerminal.storageAccountKey, this.tfTerminal.fileShareName, path.join(localPath, CREATE_ACI_SCRIPT)),
                azFilePush(workspaceName, this.tfTerminal.storageAccountName, this.tfTerminal.storageAccountKey, this.tfTerminal.fileShareName, path.join(localPath, CONTAINER_CMD_SCRIPT)),
            ]);
            await this.runTFCommand(`cd ~/clouddrive/${cloudDrivePath} && source ${CREATE_ACI_SCRIPT} && terraform fmt && terraform init && terraform apply -auto-approve && terraform taint azurerm_container_group.TFTest && \
                               echo "\nRun the following command to get the logs from the ACI container: az container logs -g ${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")} -n ${vscode.workspace.getConfiguration("tf-azure").get("aci-name")}\n"`, cloudDrivePath, this.tfTerminal.terminal);
            vscode.window.showInformationMessage(`An Azure Container Instance will be created in the Resource Group '${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")}' if the command executes successfully.`);

        } else {
            const message = "A CloudShell session is needed, do you want to open CloudShell?";
            const response: MessageItem = await vscode.window.showWarningMessage(message, DialogOption.OK, DialogOption.CANCEL);
            if (response === DialogOption.OK) {
                const terminal: Terminal = await this.startCloudShell();
                this.tfTerminal.terminal = terminal[0];
                this.tfTerminal.ws = terminal[1];
                this.tfTerminal.storageAccountName = terminal[2];
                this.tfTerminal.storageAccountKey = terminal[3];
                this.tfTerminal.fileShareName = terminal[4];
                this.tfTerminal.ResourceGroup = terminal[5];
                console.log(`Obtained terminal and fileshare data\n`);
                await this.runTerraformTests(testType, workingDirectory);
            }

            console.log("Terminal not opened when trying to transfer files");
        }

    }

    protected async runTerraformInternal(TFCommand: string, WorkDir: string): Promise<void> {
        // Workaround the TLS error
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        // TODO: Check if logged with azure account
        if (this.tfTerminal.terminal == null) {
            const terminal: Terminal = await this.startCloudShell();
            this.tfTerminal.terminal = terminal[0];
            this.tfTerminal.ws = terminal[1];
            this.tfTerminal.storageAccountName = terminal[2];
            this.tfTerminal.storageAccountKey = terminal[3];
            this.tfTerminal.fileShareName = terminal[4];
            this.tfTerminal.ResourceGroup = terminal[5];
            await this.runTFCommand(TFCommand, WorkDir, this.tfTerminal.terminal);
        } else {
            await this.runTFCommand(TFCommand, WorkDir, this.tfTerminal.terminal);
        }

    }

    protected initShellInternal() {
        this.tfTerminal = new TFTerminal(TerminalType.CloudShell, Constants.TerraformTerminalName);
        vscode.window.onDidCloseTerminal(async (terminal) => {
            if (terminal === this.tfTerminal.terminal) {
                this.dispose();
                await fsExtra.remove(tempFile);
            }
        });
    }

    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string): void {
        return null;
    }

    protected async startCloudShell(): Promise<Terminal> {
        const accountAPI: AzureAccount = vscode.extensions
            .getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        const azureSubscription: AzureSubscription = vscode.extensions
            .getExtension<AzureSubscription>("ms-vscode.azure-account")!.exports;

        const operationSystem = process.platform === "win32" ? OSes.Windows : OSes.Linux;
        return await openCloudConsole(accountAPI, azureSubscription, operationSystem, tempFile);
    }

    protected async runTFCommand(command: string, workdir: string, terminal: Terminal): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let count: number = 30;
            while (count--) {
                if (await fsExtra.pathExists(tempFile)) {
                    if (terminal) {
                        terminal.sendText(`${command}`);
                        terminal.show();
                        return resolve();
                    }
                }
                await delay(500);
            }
            reject("Connecting to terminal failed, please retry.");
        });
    }

    private terminalInitialized(): Promise<boolean> {
        return new Promise<boolean>(async (resolve) => {
            if ((this.tfTerminal.terminal !== null) && (this.tfTerminal.storageAccountKey !== undefined)) {
                resolve(true);
            } else {
                const message = "Do you want to open CloudShell?";
                const response: MessageItem = await vscode.window.showWarningMessage(message, DialogOption.OK, DialogOption.CANCEL);
                if (response === DialogOption.OK) {
                    const terminal: Terminal = await this.startCloudShell();
                    this.tfTerminal.terminal = terminal[0];
                    this.tfTerminal.ws = terminal[1];
                    this.tfTerminal.storageAccountName = terminal[2];
                    this.tfTerminal.storageAccountKey = terminal[3];
                    this.tfTerminal.fileShareName = terminal[4];
                    this.tfTerminal.ResourceGroup = terminal[5];
                    terraformChannel.appendLine("Obtained cloudshell terminal, retrying push files.");
                    resolve(true);
                } else {
                    console.log("Open CloudShell cancelled by user.");
                    resolve(false);
                }
            }
        });
    }

    private async resolveContainerCmd(TestType: string): Promise<string> {
        switch (TestType) {
            case TestOption.lint:
                return "rake -f ../../Rakefile build";
            case TestOption.e2enossh:
            case TestOption.e2ewithssh:
                return "rake -f ../../Rakefile e2e";
            case TestOption.custom:
                const cmd: string = await vscode.window.showInputBox({
                    prompt: "Type your custom test command",
                    value: "rake -f ../Rakefile build",
                });
                return cmd ? cmd : "";
            default:
                return "";
        }
    }
}

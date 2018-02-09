"use strict";

import * as fsExtra from "fs-extra";
import * as _ from "lodash";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { MessageItem } from "vscode";
import { AzureAccount, AzureSubscription } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { openCloudConsole, OSes } from "./cloudConsole";
import { delay } from "./cloudConsoleLauncher";
import { aciConfig, Constants, exportContainerCmd, exportTestScript } from "./constants";
import { azFilePush, escapeFile, TerminalType, TestOption, TFTerminal } from "./shared";
import { terraformChannel } from "./terraformChannel";
import { DialogOption, DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";

const tempFile = path.join(os.tmpdir(), "cloudshell" + vscode.env.sessionId + ".log");

export class CloudShell extends BaseShell {

    public async pushFiles(files: vscode.Uri[]): Promise<void> {
        terraformChannel.appendLine("Attempting to upload files to CloudShell...");

        if (await this.connectedToCloudShell()) {
            const promises: Array<Promise<void>> = [];
            for (const file of files.map((a) => a.fsPath)) {
                promises.push(this.pushFilePromise(file));
            }

            try {
                await Promise.all(promises);
                await vscode.window.showInformationMessage("Synced all matched files in the current workspace to CloudShell");
            } catch (error) {
                terraformChannel.appendLine(error);
                await promptForOpenOutputChannel("Failed to push files to the cloud. Please open the output channel for more details.", DialogType.error);

            }
        }
    }

    public async runTerraformTests(testType: string, workingDirectory: string) {
        if (await this.connectedToCloudShell()) {
            const choice: vscode.MessageItem = await vscode.window.showInformationMessage(
                "Would you like to push the terraform project files to CloudShell?",
                DialogOption.OK,
                DialogOption.CANCEL,
            );
            if (choice === DialogOption.OK) {
                await vscode.commands.executeCommand("vscode-terraform-azure.push");
            }

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

            await Promise.all([
                fsExtra.outputFile(path.join(localPath, CREATE_ACI_SCRIPT), shellscript),
                fsExtra.outputFile(path.join(localPath, CONTAINER_CMD_SCRIPT), exportContainerCmd(workspaceName, await this.resolveContainerCmd(testType))),
            ]);

            await Promise.all([
                azFilePush(workspaceName, this.tfTerminal.storageAccountName, this.tfTerminal.storageAccountKey, this.tfTerminal.fileShareName, path.join(localPath, CREATE_ACI_SCRIPT)),
                azFilePush(workspaceName, this.tfTerminal.storageAccountName, this.tfTerminal.storageAccountKey, this.tfTerminal.fileShareName, path.join(localPath, CONTAINER_CMD_SCRIPT)),
            ]);

            const sentToTerminal: boolean = await this.runTFCommand(`cd ~/clouddrive/${cloudDrivePath} && source ${CREATE_ACI_SCRIPT} && terraform fmt && terraform init && terraform apply -auto-approve && terraform taint azurerm_container_group.TFTest && \
                               echo "\nRun the following command to get the logs from the ACI container: az container logs -g ${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")} -n ${vscode.workspace.getConfiguration("tf-azure").get("aci-name")}\n"`, cloudDrivePath);
            if (sentToTerminal) {
                vscode.window.showInformationMessage(`An Azure Container Instance will be created in the Resource Group '${vscode.workspace.getConfiguration("tf-azure").get("aci-ResGroup")}' if the command executes successfully.`);
            } else {
                vscode.window.showErrorMessage("Failed to send the command to terminal, please try it again.");
            }
        }
    }

    public async runTerraformCmd(tfCommand: string, workingDir: string): Promise<void> {
        // Workaround the TLS error
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (await this.connectedToCloudShell()) {
            await this.runTFCommand(tfCommand, workingDir);
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

    protected async startCloudShell(): Promise<any[]> {
        const accountAPI: AzureAccount = vscode.extensions
            .getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        const azureSubscription: AzureSubscription = vscode.extensions
            .getExtension<AzureSubscription>("ms-vscode.azure-account")!.exports;

        const operationSystem = process.platform === "win32" ? OSes.Windows : OSes.Linux;
        return await openCloudConsole(accountAPI, azureSubscription, operationSystem, tempFile);
    }

    protected async runTFCommand(command: string, workdir: string): Promise<boolean> {
        let count: number = 30;
        while (count--) {
            if (await fsExtra.pathExists(tempFile)) {
                if (this.tfTerminal.terminal) {
                    this.tfTerminal.terminal.show();
                    this.tfTerminal.terminal.sendText(`${command}`);
                    return true;
                }
            }
            await delay(500);
        }
        return false;
    }

    private async connectedToCloudShell(): Promise<boolean> {
        if (this.tfTerminal.terminal && this.tfTerminal.storageAccountKey) {
            return true;
        }

        const message = "Do you want to open CloudShell?";
        const response: MessageItem = await vscode.window.showWarningMessage(message, DialogOption.OK, DialogOption.CANCEL);
        if (response === DialogOption.OK) {
            const terminal: any[] = await this.startCloudShell();
            if (_.isEmpty(terminal)) {
                return false;
            }
            this.tfTerminal.terminal = terminal[0];
            this.tfTerminal.ws = terminal[1];
            this.tfTerminal.storageAccountName = terminal[2];
            this.tfTerminal.storageAccountKey = terminal[3];
            this.tfTerminal.fileShareName = terminal[4];
            this.tfTerminal.ResourceGroup = terminal[5];
            terraformChannel.appendLine("Cloudshell terminal opened.");
            return true;
        }

        console.log("Open CloudShell cancelled by user.");
        return false;
    }

    private async pushFilePromise(file: string): Promise<void> {
        if (await fsExtra.pathExists(file)) {
            terraformChannel.appendLine(`Uploading file ${file} to cloud shell`);
            await azFilePush(
                vscode.workspace.getWorkspaceFolder(vscode.Uri.file(file)).name,
                this.tfTerminal.storageAccountName,
                this.tfTerminal.storageAccountKey,
                this.tfTerminal.fileShareName,
                file,
            );
        }
    }

    private async resolveContainerCmd(TestType: string): Promise<string> {
        switch (TestType) {
            case TestOption.lint:
                return "rake -f ../Rakefile build";
            case TestOption.e2e:
                return "ssh-keygen -t rsa -b 2048 -C terraformTest -f /root/.ssh/id_rsa -N ''; rake -f ../Rakefile e2e";
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

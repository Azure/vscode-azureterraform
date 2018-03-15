"use strict";

import * as fsExtra from "fs-extra";
import * as path from "path";
import { MessageItem } from "vscode";
import * as vscode from "vscode";
import { TelemetryWrapper } from "vscode-extension-telemetry-wrapper";
import { AzureAccount, CloudShell } from "./azure-account.api";
import { BaseShell } from "./baseShell";
import { aciConfig, Constants, exportContainerCmd, exportTestScript } from "./constants";
import { azFilePush, escapeFile, TestOption } from "./shared";
import { terraformChannel } from "./terraformChannel";
import { getStorageAccountforCloudShell, IStorageAccount } from "./utils/clouShellUtils";
import { DialogOption, DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

export class AzureCloudShell extends BaseShell {

    private cloudShell: CloudShell;
    private resourceGroup: string;
    private storageAccountName: string;
    private storageAccountKey: string;
    private fileShareName: string;

    public async pushFiles(files: vscode.Uri[]): Promise<void> {
        terraformChannel.appendLine("Attempting to upload files to CloudShell...");

        if (await this.connectedToCloudShell()) {
            const promises: Array<Promise<void>> = [];
            for (const file of files.map((a) => a.fsPath)) {
                promises.push(this.pushFilePromise(file));
            }

            try {
                await Promise.all(promises);
                vscode.window.showInformationMessage("Synced all matched files in the current workspace to CloudShell");
            } catch (error) {
                terraformChannel.appendLine(error);
                await promptForOpenOutputChannel("Failed to push files to the cloud. Please open the output channel for more details.", DialogType.error);

            }
        }
    }

    public async runTerraformTests(testType: string, workingDirectory: string) {
        if (await this.connectedToCloudShell()) {

            const workspaceName: string = path.basename(workingDirectory);
            const setupFilesFolder: string = `${workspaceName}/.TFTesting`;
            const localPath: string = path.join(workingDirectory, ".TFTesting");
            const createAciScript: string = "createacitest.sh";
            const containerCommandScript: string = "containercmd.sh";
            const resourceGroup: string = vscode.workspace.getConfiguration("azureTerraform").get("aci-ResGroup");
            const aciName: string = vscode.workspace.getConfiguration("azureTerraform").get("aci-name");
            const aciGroup: string = vscode.workspace.getConfiguration("azureTerraform").get("aci-group");

            const TFConfiguration = escapeFile(aciConfig(
                resourceGroup,
                aciName,
                aciGroup,
                this.storageAccountName,
                this.fileShareName,
                vscode.workspace.getConfiguration("azureTerraform").get("test-location"),
                vscode.workspace.getConfiguration("azureTerraform").get("test-container"),
                workspaceName,
            ));

            const shellscript = exportTestScript(TFConfiguration, this.resourceGroup, this.storageAccountName, setupFilesFolder);

            await Promise.all([
                fsExtra.outputFile(path.join(localPath, createAciScript), shellscript),
                fsExtra.outputFile(path.join(localPath, containerCommandScript), exportContainerCmd(workspaceName, await this.resolveContainerCmd(testType))),
            ]);

            await Promise.all([
                azFilePush(workspaceName, this.storageAccountName, this.storageAccountKey, this.fileShareName, path.join(localPath, createAciScript)),
                azFilePush(workspaceName, this.storageAccountName, this.storageAccountKey, this.fileShareName, path.join(localPath, containerCommandScript)),
            ]);

            const sentToTerminal: boolean = await this.runTFCommand(
                `source ${createAciScript} && terraform fmt && terraform init && terraform apply -auto-approve && terraform taint azurerm_container_group.TFTest && \
                echo "\nRun the following command to get the logs from the ACI container: az container logs -g ${resourceGroup} -n ${aciName}\n"`,
                `${Constants.clouddrive}/${setupFilesFolder}`,
            );
            if (sentToTerminal) {
                vscode.window.showInformationMessage(`An Azure Container Instance will be created in the Resource Group '${resourceGroup}' if the command executes successfully.`);
            } else {
                vscode.window.showErrorMessage("Failed to send the command to terminal, please try it again.");
            }
        }
    }

    public async runTerraformCmd(tfCommand: string): Promise<void> {
        if (await this.connectedToCloudShell()) {
            const workingDirectory: string = await selectWorkspaceFolder();
            await this.runTFCommand(tfCommand, workingDirectory ? `${Constants.clouddrive}/${path.basename(workingDirectory)}` : "");
        }
    }

    protected initShellInternal() {
        vscode.window.onDidCloseTerminal(async (terminal) => {
            if (terminal === this.terminal) {
                this.dispose();
                this.cloudShell = undefined;
                this.resourceGroup = undefined;
                this.storageAccountName = undefined;
                this.storageAccountKey = undefined;
                this.fileShareName = undefined;
            }
        });
    }

    protected async runTFCommand(command: string, workdir: string): Promise<boolean> {
        if (this.terminal) {
            this.terminal.show();
            if (await this.cloudShell.waitForConnection()) {
                if (workdir) {
                    this.terminal.sendText(`cd "${workdir}"`);
                }
                this.terminal.sendText(`${command}`);
                return true;
            } else {
                vscode.window.showErrorMessage("Establish connection to Cloud Shell failed, please try again later.");
                TelemetryWrapper.error("connectFail");
                return false;
            }
        }
        TelemetryWrapper.error("sendToTerminalFail");
        return false;
    }

    private async connectedToCloudShell(): Promise<boolean> {
        if (this.terminal) {
            return true;
        }

        const message = "Do you want to open CloudShell?";
        const response: MessageItem = await vscode.window.showWarningMessage(message, DialogOption.ok, DialogOption.cancel);
        if (response === DialogOption.ok) {
            const accountAPI: AzureAccount = vscode.extensions
                .getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

            this.cloudShell =  accountAPI.createCloudShell("Linux");

            this.terminal = await this.cloudShell.terminal;
            this.terminal.show();
            const storageAccount: IStorageAccount = await getStorageAccountforCloudShell(this.cloudShell);
            if (!storageAccount) {
                vscode.window.showErrorMessage("Failed to get the Storage Account information for Cloud Shell, please try again later.");
                return false;
            }

            this.resourceGroup = storageAccount.resourceGroup;
            this.storageAccountName = storageAccount.storageAccountName;
            this.storageAccountKey = storageAccount.storageAccountKey;
            this.fileShareName = storageAccount.fileShareName;

            terraformChannel.appendLine("Cloudshell terminal opened.");

            const choice: vscode.MessageItem = await vscode.window.showInformationMessage(
                "Would you like to push the terraform project files in current workspace to Cloud Shell?",
                DialogOption.ok,
                DialogOption.cancel,
            );
            if (choice === DialogOption.ok) {
                await vscode.commands.executeCommand("azureTerraform.push");
            }
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
                this.storageAccountName,
                this.storageAccountKey,
                this.fileShareName,
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

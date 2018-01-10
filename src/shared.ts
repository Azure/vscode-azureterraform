"use strict";

import * as azure from "azure-storage";
import * as path from "path";
import * as vscode from "vscode";

import { WebResource } from "ms-rest";
import { AzureAccount, AzureLoginStatus, AzureSession, AzureSubscription } from "./azure-account.api";

export class TFTerminal {

    public type: TerminalType;
    public terminal: vscode.Terminal;
    public name: string;
    public ws;
    public storageAccountKey: string;
    public storageAccountName: string;
    public fileShareName: string;

    constructor(type: TerminalType, name: string) {
        this.type = type;
        this.name = name;
    }
}

export enum TerminalType {
    Integrated = "integrated",
    CloudShell = "cloudshell",
}

export enum Option {
    docker = "docker",
    local = "local",
    cloudshell = "cloudshell",
}

export function escapeFile(data: string): string {
    return data.replace(/"/g, '\\"');
}

export function azFileDelete(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): boolean {
    return true;
}

export function azFilePull(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string,
    savePath: string): void {
    const filesService = azure.createFileService(storageAccountName, storageAccountKey);
}

export function azFilePush(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): void {
    const filesService = azure.createFileService(storageAccountName, storageAccountKey);
    const dirname = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, fileName));

    filesService.createShareIfNotExists(fileShareName, (error, result, response) => {
        if (!error) {
            let dir = "";
            for (const newdir of dirname.split(path.sep)) {
                dir = dir + "/" + newdir;
                filesService.createDirectoryIfNotExists(fileShareName, dir , (e, res, resp) => {
                    if (!e) {
                        console.log(`Created dir ${dir}`);
                    }
                });
            }

            filesService.createFileFromLocalFile(fileShareName, dirname,
                path.basename(fileName), fileName , (e, res, resp) => {
                if (!e) {
                    console.log(`File ${path.basename(fileName)} uploaded correctly`);
                } else {
                    console.log(`Error: ${e}`);
                }
                return;
            });
        }
    });
}

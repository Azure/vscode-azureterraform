"use strict";

import * as azureStorage from "azure-storage";
import * as path from "path";
import * as vscode from "vscode";

import { FileService } from "azure-storage";
import { WebResource } from "ms-rest";
import { AzureAccount, AzureLoginStatus, AzureSession, AzureSubscription } from "./azure-account.api";
import { CloudFile } from "./cloudFile";
import { IExecResult } from "./utilities";

export class TFTerminal {

    public type: TerminalType;
    public terminal: vscode.Terminal;
    public name: string;
    public ws;
    public storageAccountKey: string;
    public storageAccountName: string;
    public fileShareName: string;
    public ResourceGroup: string;

    constructor(type: TerminalType, name: string) {
        this.type = type;
        this.name = name;
    }
}

export enum TerminalType {
    Integrated = "integrated",
    CloudShell = "cloudshell",
}

export enum FileSystem {
    docker = "docker",
    local = "local",
    cloudshell = "cloudshell",
}

export function escapeFile(data: string): string {
    return data.replace(/"/g, '\\"').replace(/\$/g, "\\\$");
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

    const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
}

export async function azFilePush(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): Promise<void> {

    const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
    const cloudFile = new CloudFile (vscode.workspace.name, fileShareName, fileName, FileSystem.local);
    const pathCount = cloudFile.cloudShellDir.split(path.sep).length;

    // try create file share if it does not exist
    try {
        await createShare(cloudFile.fileShareName, filesService);
    } catch (error) {
        console.log(`Error creating FileShare: ${cloudFile.fileShareName}\n\n${error}`);
        return;
    }

    // try create directory path if it does not exist, dirs need to be created at each level
    try {
        for (let i = 0; i < pathCount; i++) {
            await createDirectoryPath(cloudFile.fileShareName, cloudFile.cloudShellDir, i, filesService);
        }
    } catch (error) {
        console.log(`Error creating directory: ${cloudFile.cloudShellDir}\n\n${error}`);
        return;
    }

    // try create file if not exist
    try {
        await createFile(cloudFile.fileShareName, cloudFile.cloudShellDir, cloudFile.localUri, filesService);
    } catch (error) {
        console.log(`Error creating file: ${cloudFile.localUri}\n\n${error}`);
    }

    return;
}

function createShare(fileShareName: string, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.createShareIfNotExists(fileShareName, ((error, result, response) => {
            if (!error) {
                if (result && result.created) { // only log if created
                    console.log(`FileShare: ${fileShareName} created.`);
                }
                resolve();
            } else {
                reject(error);
            }
        }));
    });
}

function createDirectoryPath(fileShareName: string, dir: string, i: number, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let tempDir = "";
        const dirArray = dir.split(path.sep);
        for (let j = 0; j < dirArray.length && j <= i; j++) {
            tempDir = tempDir + dirArray[j] + "/";

        }
        fs.createDirectoryIfNotExists(fileShareName, tempDir, ((error, result, response) => {
            if (!error) {
                if (result && result.created) { // only log if created TODO: This check is buggy, open issue in Azure Storage NODE SDK.
                    console.log(`Created dir: ${tempDir}`);
                }
                resolve();
            } else {
                reject(error);
            }
        }));
    });
}

function createFile(fileShareName: string, dir: string, filePath: string, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void> ((resolve, reject) => {
        const fileName = path.basename(filePath);
        fs.createFileFromLocalFile(fileShareName, dir, fileName, filePath, (error, result, response) => {
            if (!error) {
                console.log(`File in sync: ${fileName}`);
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

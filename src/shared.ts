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

export async function azFileDelete(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    localFileUri: string): Promise<void> {

    const fs = azureStorage.createFileService(storageAccountName, storageAccountKey);
    const cf = new CloudFile(
        vscode.workspace.name,
        fileShareName,
        localFileUri,
        FileSystem.local);

    await deleteFile(cf, fs);
}

export async function azFilePull(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    cloudShellFileName: string): Promise<void> {

    const fs = azureStorage.createFileService(storageAccountName, storageAccountKey);
    const cf = new CloudFile(
        vscode.workspace.name,
        fileShareName,
        cloudShellFileName,
        FileSystem.cloudshell);

    await readFile(cf, fs);
}

export async function azFilePush(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): Promise<void> {

    const fs = azureStorage.createFileService(storageAccountName, storageAccountKey);
    const cf = new CloudFile(
        vscode.workspace.name,
        fileShareName,
        fileName,
        FileSystem.local);
    const pathCount = cf.cloudShellDir.split(path.sep).length;

    // try create file share if it does not exist
    try {
        await createShare(cf, fs);
    } catch (error) {
        console.log(`Error creating FileShare: ${cf.fileShareName}\n\n${error}`);
        return;
    }

    // try create directory path if it does not exist, dirs need to be created at each level
    try {
        for (let i = 0; i < pathCount; i++) {
            await createDirectoryPath(cf, i, fs);
        }
    } catch (error) {
        console.log(`Error creating directory: ${cf.cloudShellDir}\n\n${error}`);
        return;
    }

    // try create file if not exist
    try {
        await createFile(cf, fs);
    } catch (error) {
        console.log(`Error creating file: ${cf.localUri}\n\n${error}`);
    }

    return;
}

function createShare(cf: CloudFile, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.createShareIfNotExists(cf.fileShareName, ((error, result, response) => {
            if (!error) {
                if (result && result.created) { // only log if created
                    console.log(`FileShare: ${cf.fileShareName} created.`);
                }
                resolve();
            } else {
                reject(error);
            }
        }));
    });
}

function createDirectoryPath(cf: CloudFile, i: number, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let tempDir = "";
        const dirArray = cf.cloudShellDir.split(path.sep);
        for (let j = 0; j < dirArray.length && j <= i; j++) {
            tempDir = tempDir + dirArray[j] + "/";

        }
        fs.createDirectoryIfNotExists(cf.fileShareName, tempDir, ((error, result, response) => {
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

function createFile(cf: CloudFile, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const fileName = path.basename(cf.localUri);
        fs.createFileFromLocalFile(cf.fileShareName, cf.cloudShellDir, fileName, cf.localUri, (error, result, response) => {
            if (!error) {
                console.log(`File synced to cloud: ${fileName}`);
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

function readFile(cf: CloudFile, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const fileName = path.basename(cf.cloudShellUri);
        fs.getFileToLocalFile(cf.fileShareName, cf.cloudShellDir, fileName, cf.localUri, (error, result, response) => {
            if (!error) {
                console.log(`File synced to local workspace: ${cf.localUri}`);
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

function deleteFile(cf: CloudFile, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const fileName = path.basename(cf.localUri);
        fs.deleteFileIfExists(cf.fileShareName, cf.cloudShellDir, fileName, (error, result, response) => {
            if (!error) {
                if (result) {
                    console.log(`File deleted from cloudshell: ${cf.cloudShellUri}`);
                } else {
                    console.log(`File does not exist in cloudshell: ${cf.cloudShellUri}`);
                }
                resolve();
            } else {
                reject(error);
            }
        });
    });
}
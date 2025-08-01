/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import {
  ShareServiceClient,
  StorageSharedKeyCredential,
  ShareClient,
} from "@azure/storage-file-share";
import * as path from "path";
import * as fs from "fs";
import { CloudFile } from "./cloudFile";

export enum TerminalType {
  Integrated = "integrated",
  CloudShell = "cloudshell",
}

export enum FileSystem {
  docker = "docker",
  local = "local",
  cloudshell = "cloudshell",
}

export enum TestOption {
  lint = "lint",
  e2e = "end to end",
  custom = "custom",
}

export enum TerraformCommand {
  Init = "terraform init",
  Plan = "terraform plan",
  Apply = "terraform apply",
  Destroy = "terraform destroy",
  Refresh = "terraform refresh",
  Validate = "terraform validate",
}

export function escapeFile(data: string): string {
  return data.replace(/"/g, '\\"').replace(/\$/g, "\\$");
}

export async function azFileDelete(
  workspaceName: string,
  storageAccountName: string,
  storageAccountKey: string,
  fileShareName: string,
  localFileUri: string
): Promise<void> {
  const credential = new StorageSharedKeyCredential(
    storageAccountName,
    storageAccountKey
  );
  const serviceClient = new ShareServiceClient(
    `https://${storageAccountName}.file.core.windows.net`,
    credential
  );
  const shareClient = serviceClient.getShareClient(fileShareName);

  const cf = new CloudFile(
    workspaceName,
    fileShareName,
    localFileUri,
    FileSystem.local
  );

  await deleteFile(cf, shareClient);
}

export async function azFilePull(
  workspaceName: string,
  storageAccountName: string,
  storageAccountKey: string,
  fileShareName: string,
  cloudShellFileName: string
): Promise<void> {
  const credential = new StorageSharedKeyCredential(
    storageAccountName,
    storageAccountKey
  );
  const serviceClient = new ShareServiceClient(
    `https://${storageAccountName}.file.core.windows.net`,
    credential
  );
  const shareClient = serviceClient.getShareClient(fileShareName);

  const cf = new CloudFile(
    workspaceName,
    fileShareName,
    cloudShellFileName,
    FileSystem.cloudshell
  );

  await readFile(cf, shareClient);
}

export async function azFilePush(
  workspaceName: string,
  storageAccountName: string,
  storageAccountKey: string,
  fileShareName: string,
  fileName: string
): Promise<void> {
  const credential = new StorageSharedKeyCredential(
    storageAccountName,
    storageAccountKey
  );
  const serviceClient = new ShareServiceClient(
    `https://${storageAccountName}.file.core.windows.net`,
    credential
  );
  const shareClient = serviceClient.getShareClient(fileShareName);

  const cf = new CloudFile(
    workspaceName,
    fileShareName,
    fileName,
    FileSystem.local
  );
  const pathCount = cf.cloudShellDir.split(path.sep).length;

  // try create file share if it does not exist
  try {
    await createShare(cf, shareClient);
  } catch (error) {
    console.log(`Error creating FileShare: ${cf.fileShareName}\n\n${error}`);
    return;
  }

  // try create directory path if it does not exist, dirs need to be created at each level
  try {
    for (let i = 0; i < pathCount; i++) {
      await createDirectoryPath(cf, i, shareClient);
    }
  } catch (error) {
    console.log(`Error creating directory: ${cf.cloudShellDir}\n\n${error}`);
    return;
  }

  // try create file if not exist
  try {
    await createFile(cf, shareClient);
  } catch (error) {
    console.log(`Error creating file: ${cf.localUri}\n\n${error}`);
  }

  return;
}

async function createShare(
  cf: CloudFile,
  shareClient: ShareClient
): Promise<void> {
  const response = await shareClient.createIfNotExists();
  if (response.succeeded) {
    console.log(`FileShare: ${cf.fileShareName} created.`);
  }
}

async function createDirectoryPath(
  cf: CloudFile,
  i: number,
  shareClient: ShareClient
): Promise<void> {
  let tempDir = "";
  const dirArray = cf.cloudShellDir.split(path.sep);
  for (let j = 0; j < dirArray.length && j <= i; j++) {
    tempDir = tempDir + dirArray[j] + "/";
  }

  const directoryClient = shareClient.getDirectoryClient(tempDir);
  const response = await directoryClient.createIfNotExists();
  if (response.succeeded) {
    console.log(`Created dir: ${tempDir}`);
  }
}

async function createFile(
  cf: CloudFile,
  shareClient: ShareClient
): Promise<void> {
  const fileName = path.basename(cf.localUri);
  const directoryClient = shareClient.getDirectoryClient(cf.cloudShellDir);
  const fileClient = directoryClient.getFileClient(fileName);

  // Read the local file
  const fileContent = fs.readFileSync(cf.localUri);

  // Upload the file
  await fileClient.uploadData(fileContent);
  console.log(`File synced to cloud: ${fileName}`);
}

async function readFile(
  cf: CloudFile,
  shareClient: ShareClient
): Promise<void> {
  const fileName = path.basename(cf.cloudShellUri);
  const directoryClient = shareClient.getDirectoryClient(cf.cloudShellDir);
  const fileClient = directoryClient.getFileClient(fileName);

  const downloadResponse = await fileClient.download();
  if (downloadResponse.readableStreamBody) {
    const writeStream = fs.createWriteStream(cf.localUri);

    await new Promise((resolve, reject) => {
      if (downloadResponse.readableStreamBody) {
        downloadResponse.readableStreamBody.pipe(writeStream);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
      } else {
        reject(new Error("No readable stream body"));
      }
    });

    console.log(`File synced to local workspace: ${cf.localUri}`);
  }
}

async function deleteFile(
  cf: CloudFile,
  shareClient: ShareClient
): Promise<void> {
  const fileName = path.basename(cf.localUri);
  const directoryClient = shareClient.getDirectoryClient(cf.cloudShellDir);
  const fileClient = directoryClient.getFileClient(fileName);

  try {
    await fileClient.deleteIfExists();
    console.log(`File deleted from cloudshell: ${cf.cloudShellUri}`);
  } catch (error) {
    console.log(`File does not exist in cloudshell: ${cf.cloudShellUri}`);
    throw error;
  }
}

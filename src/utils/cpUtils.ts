/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as cp from "child_process";
import { terraformChannel } from "../terraformChannel";

export async function executeCommand(command: string, args: string[], options: cp.SpawnOptions): Promise<string> {
    return new Promise((resolve: (res: string) => void, reject: (e: Error) => void): void => {
        let result: string = "";
        const childProc: cp.ChildProcess = cp.spawn(command, args, options);

        childProc.stdout.on("data", (data: string | Buffer) => {
            data = data.toString();
            result = result.concat(data);
            terraformChannel.append(data);
        });

        childProc.stderr.on("data", (data: string | Buffer) => terraformChannel.append(data.toString()));

        childProc.on("error", reject);
        childProc.on("close", (code: number) => {
            if (code !== 0) {
                reject(new Error(`Command "${command} ${args.toString()}" failed with exit code "${code}".`));
            } else {
                resolve(result);
            }
        });
    });
}

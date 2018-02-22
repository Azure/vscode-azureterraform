"use strict";

import { TFTerminal } from "./shared";
import { terraformChannel } from "./terraformChannel";

export abstract class BaseShell {

    protected tfTerminal: TFTerminal;

    constructor() {
        this.initShellInternal();
    }

    public abstract runTerraformCmd(tfCommand: string);

    public abstract runTerraformTests(testType: string, workingDirectory: string);

    protected isWindows(): boolean {
        return process.platform === "win32";
    }

    protected dispose(): void {
        terraformChannel.appendLine("Terraform Terminal closed", this.tfTerminal.name);
        this.tfTerminal.terminal = undefined;
        this.tfTerminal.storageAccountKey = undefined;
        if (this.tfTerminal.ws) {
            this.tfTerminal.ws.close();
            this.tfTerminal.ws = undefined;
        }
    }

    protected abstract initShellInternal();
}

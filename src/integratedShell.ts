"use strict";

import * as vscode from 'vscode';
import { BaseShell } from './baseShell';
import { extensions, commands, Disposable, window } from 'vscode';
import { TFTerminal, TerminalType} from './shared'
import { Constants } from './constants'


export class IntegratedShell extends BaseShell {

    protected iTerm = new TFTerminal(
        TerminalType.Integrated, 
        Constants.TerraformTerminalName);

    protected initShellInternal() {
        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.iTerm.terminal ) {
                    this.outputLine('Terraform Terminal closed', terminal.name);
                    this.iTerm.terminal = null;
                }
            });
        }
    }

    protected runTerraformInternal(TFconfiguration: string, TFCommand: string): void {
        this.checkCreateTerminal();
        
        var term = this.iTerm.terminal;
        
        term.show();
        term.sendText(TFCommand);
        return;
    }

    protected syncWorkspaceInternal()
    {
        //not implemented for integrated terminal
    }

    private checkCreateTerminal(): void {
        
        if ( this.iTerm.terminal == null ) {
            this.iTerm.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }
    


}


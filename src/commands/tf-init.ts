import * as vscode from "vscode";
import * as path from "path";
import * as extension from '../extension'

export async function tfinit (context: vscode.ExtensionContext) {

    var myterminal = extension.getTerraformTerminal();

    extension.tfterminal.show();
    extension.tfterminal.sendText(`terraform init`);
    
}

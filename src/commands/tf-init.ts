import * as vscode from "vscode";
import * as path from "path";
import * as extension from '../extension'
import { AzureAccount } from '../azure-account.api'
import { openCloudConsole, OSes } from "../cloudConsole";

export async function tfinit (context: vscode.ExtensionContext) {

    const azureAccount: AzureAccount = vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;

    // openCloudConsole(azureAccount, OSes.Linux).then(terminal => {

    // });
    //await extension.TFLogin(azureAccount);

    //extension.tfterminal.show();
    // extension.tfterminal.sendText(`terraform init`);

    //myterminal.sendText('ls');

    
}

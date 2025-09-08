import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";

const INSTALL_FOLDER_NAME = "bin";
export const PREFLIGHT_CUSTOM_BIN_PATH_OPTION_NAME =
  "aztfpreflight.pathToBinary";

export class PreflightPath {
  private customBinPath: string | undefined;

  constructor(private context: vscode.ExtensionContext) {
    this.customBinPath = vscode.workspace
      .getConfiguration("azureTerraform")
      .get(PREFLIGHT_CUSTOM_BIN_PATH_OPTION_NAME);
  }

  public installPath(): string {
    return path.join(this.context.extensionPath, INSTALL_FOLDER_NAME);
  }

  public hasCustomBinPath(): boolean {
    return !!this.customBinPath;
  }

  public binPath(): string {
    if (this.customBinPath) {
      return this.customBinPath;
    }
    return path.resolve(this.installPath(), this.binName());
  }

  public binName(): string {
    if (this.customBinPath) {
      return path.basename(this.customBinPath);
    }
    if (process.platform === "win32") {
      return "aztfpreflight.exe";
    }
    return "aztfpreflight";
  }

  public async resolvedPathToBinary(): Promise<string> {
    const pathToBinary = this.binPath();
    let cmd: string;
    try {
      if (path.isAbsolute(pathToBinary)) {
        await vscode.workspace.fs.stat(vscode.Uri.file(pathToBinary));
        cmd = pathToBinary;
      } else {
        cmd = which.sync(pathToBinary);
      }
      console.log(`Found aztfpreflight at ${cmd}`);
    } catch (err) {
      let extraHint = "";
      if (this.customBinPath) {
        extraHint = `. Check "${PREFLIGHT_CUSTOM_BIN_PATH_OPTION_NAME}" in your settings.`;
      }
      throw new Error(
        `Unable to locate aztfpreflight: ${
          err instanceof Error ? err.message : err
        }${extraHint}`
      );
    }

    return cmd;
  }
}

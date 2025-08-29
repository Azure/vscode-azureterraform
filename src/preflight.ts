"use strict";

import * as vscode from "vscode";
import type { AzureSubscription } from "@microsoft/vscode-azext-azureauth";
import { getAccessTokenFromSubscription } from "./auth";
import { PreflightPath } from "./preflightPath";

// Fetch token and run aztfpreflight in an integrated terminal so output streams live
export async function runPreflightValidation(
  subscription: AzureSubscription,
  context: vscode.ExtensionContext,
  cwd: string,
  planInputPath: string
): Promise<void> {
  const accessToken = await getAccessTokenFromSubscription(
    subscription,
    "https://management.azure.com/.default"
  );
  if (!accessToken) {
    vscode.window.showErrorMessage(
      "Failed to acquire Azure access token for the selected subscription."
    );
    return;
  }
  // Create a terminal and execute the command so output streams live
  const terminal = vscode.window.createTerminal({
    name: "Terraform: Preflight",
    cwd,
    env: {
      AZURE_ACCESS_TOKEN: accessToken.token,
      ARM_SUBSCRIPTION_ID: subscription.subscriptionId,
    },
  });
  terminal.show();
  // Resolve binary using the same strategy as ServerPath
  const pfPath = new PreflightPath(context);
  const executable = await pfPath.resolvedPathToBinary();
  const quoted = [
    quoteArg(executable),
    ...["-i", planInputPath].map(quoteArg),
  ].join(" ");
  terminal.sendText(quoted, true);
}

function quoteArg(a: string): string {
  // Leave simple args unquoted, otherwise single-quote and escape embedded single quotes
  if (/^[A-Za-z0-9._\-/]+$/.test(a)) {
    return a;
  }
  return `'${a.replace(/'/g, "'\\''")}'`;
}

"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { executeCommand } from "./cpUtils";

// Generates a Terraform plan file in the given cwd and returns the absolute plan file path.
// Throws on failure; shows progress UI while running.
export async function generateTerraformPlan(
  cwd: string,
  subscriptionId: string,
  planFileName = "planfile"
): Promise<string> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating Terraform plan",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Running terraform plan..." });
      await executeCommand("terraform", ["plan", "-out", `./${planFileName}`], {
        cwd,
        env: {
          ...process.env,
          ARM_PROVIDER_ENHANCED_VALIDATION: "false",
          ARM_SKIP_PROVIDER_REGISTRATION: "true",
          ARM_SUBSCRIPTION_ID: subscriptionId,
        },
      });
    }
  );

  return path.join(cwd, planFileName);
}

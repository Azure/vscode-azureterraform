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
  const runTerraformPlan = async (
    progress?: vscode.Progress<{ message?: string }>
  ) => {
    if (progress) {
      progress.report({ message: "Running terraform plan..." });
    }
    await executeCommand(
      "terraform",
      ["plan", "-no-color", "-out", `./${planFileName}`],
      {
        cwd,
        env: {
          ...process.env,
          ARM_PROVIDER_ENHANCED_VALIDATION: "false",
          ARM_SKIP_PROVIDER_REGISTRATION: "true",
          ARM_SUBSCRIPTION_ID: subscriptionId,
        },
      }
    );
  };

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating Terraform plan",
        cancellable: false,
      },
      async (progress) => {
        await runTerraformPlan(progress);
      }
    );

    return path.join(cwd, planFileName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if the error is about inconsistent dependency lock file
    if (
      errorMessage.includes("Inconsistent dependency lock file") ||
      errorMessage.includes("terraform init")
    ) {
      // Run terraform init and retry
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Initializing Terraform and generating plan",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Running terraform init..." });
          await executeCommand("terraform", ["init", "-no-color", "-upgrade"], {
            cwd,
            env: {
              ...process.env,
              ARM_SUBSCRIPTION_ID: subscriptionId,
            },
          });

          await runTerraformPlan(progress);
        }
      );

      return path.join(cwd, planFileName);
    } else {
      throw error;
    }
  }
}

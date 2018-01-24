"use strict";

import * as semver from "semver";
import { executeCommand } from "./cpUtils";

export async function isNodeVersionValid(): Promise<boolean> {
    try {
        const output: string = await executeCommand("node", ["-v"], { shell: true });
        const version = output.trim()[0] === "v" && output.substr(1).trim();
        if (version && semver.valid(version) && semver.gte(version, "6.0.0")) {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

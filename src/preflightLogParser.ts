"use strict";

/**
 * Represents a log entry from aztfpreflight JSON output
 */
export interface PreflightLogEntry {
  level: "info" | "error" | "warn" | "debug" | "fatal";
  msg: string;
  time: string;
}

/**
 * Represents the summary of preflight validation results
 */
export interface PreflightSummary {
  totalResources: number;
  successfulResources: number;
  failedResources: number;
  errors: PreflightError[];
  resourceResults: ResourceResult[];
}

/**
 * Represents a resource validation result
 */
export interface ResourceResult {
  resource: string;
  status: "success" | "failed";
}

/**
 * Represents a preflight validation error
 */
export interface PreflightError {
  level: "error";
  message: string;
  time: string;
}

/**
 * Parser for aztfpreflight JSON log output
 */
export class PreflightLogParser {
  private entries: PreflightLogEntry[] = [];
  private errors: PreflightError[] = [];
  private resourceResults: ResourceResult[] = [];

  /**
   * Parse a single line of JSON log output
   * @param line A single line of JSON output from aztfpreflight
   * @returns true if the line was successfully parsed, false otherwise
   */
  public parseLine(line: string): boolean {
    try {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("{")) {
        return false;
      }

      const entry: PreflightLogEntry = JSON.parse(trimmed);

      // Validate required fields
      if (!entry.level || !entry.msg || !entry.time) {
        return false;
      }

      this.entries.push(entry);
      this.processEntry(entry);
      return true;
    } catch (error) {
      // Invalid JSON, skip this line
      return false;
    }
  }

  /**
   * Parse multiple lines of JSON log output
   * @param output Multi-line string containing JSON log entries
   * @returns Array of successfully parsed entries
   */
  public parseOutput(output: string): PreflightLogEntry[] {
    const lines = output.split("\n");
    const parsedEntries: PreflightLogEntry[] = [];

    for (const line of lines) {
      if (this.parseLine(line)) {
        parsedEntries.push(this.entries[this.entries.length - 1]);
      }
    }

    return parsedEntries;
  }

  /**
   * Get the complete summary of preflight validation results
   */
  public getSummary(): PreflightSummary {
    const successfulResources = this.resourceResults.filter(
      (r) => r.status === "success"
    ).length;
    const failedResources = this.resourceResults.filter(
      (r) => r.status === "failed"
    ).length;
    const totalResources = this.resourceResults.length;

    return {
      totalResources,
      successfulResources,
      failedResources,
      errors: this.errors,
      resourceResults: this.resourceResults,
    };
  }

  /**
   * Get all parsed log entries
   */
  public getEntries(): PreflightLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get only error entries
   */
  public getErrors(): PreflightError[] {
    return [...this.errors];
  }

  /**
   * Get resource validation results
   */
  public getResourceResults(): ResourceResult[] {
    return [...this.resourceResults];
  }

  /**
   * Check if there were any validation errors
   */
  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Reset the parser state
   */
  public reset(): void {
    this.entries = [];
    this.errors = [];
    this.resourceResults = [];
  }

  /**
   * Process a single log entry and extract relevant information
   */
  private processEntry(entry: PreflightLogEntry): void {
    // Clean the message by removing trailing newlines and other whitespace
    const message = entry.msg.replace(/\n/g, "").trim();

    // Handle error and fatal entries
    if (entry.level === "error" || entry.level === "fatal") {
      const error: PreflightError = {
        level: "error",
        message: entry.msg, // Keep original message for error details
        time: entry.time,
      };
      this.errors.push(error);
      return;
    }

    // Parse resource success/failure messages
    // Handle both formats: "resource: status" and "timestamp [INFO] resource: status"
    const resourceMatch = message.match(
      /(?:.*\[INFO\]\s+)?([^:]+):\s+(success|failed)/
    );
    if (resourceMatch) {
      this.resourceResults.push({
        resource: resourceMatch[1].trim(),
        status: resourceMatch[2] as "success" | "failed",
      });
      return;
    }

    // Parse preflight errors count
    const errorsMatch = message.match(/preflight errors:\s*(\d+)/i);
    if (errorsMatch) {
      // This information is already captured by counting actual error entries
      return;
    }
  }
}

/**
 * Utility function to create a new parser instance
 */
export function createPreflightLogParser(): PreflightLogParser {
  return new PreflightLogParser();
}

/**
 * Utility function to parse preflight JSON output and return summary
 */
export function parsePreflightOutput(output: string): PreflightSummary {
  const parser = createPreflightLogParser();
  parser.parseOutput(output);
  return parser.getSummary();
}

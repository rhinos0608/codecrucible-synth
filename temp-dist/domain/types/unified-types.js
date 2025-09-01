/**
 * Unified Type System for CodeCrucible Synth
 *
 * Consolidates and organizes all type definitions following domain-driven design:
 * - Core domain types (business logic)
 * - Application types (use cases)
 * - Infrastructure types (external concerns)
 * - Value objects and entities
 */
export var CLIExitCode;
(function (CLIExitCode) {
    CLIExitCode[CLIExitCode["SUCCESS"] = 0] = "SUCCESS";
    CLIExitCode[CLIExitCode["ERROR"] = 1] = "ERROR";
    CLIExitCode[CLIExitCode["INVALID_ARGS"] = 2] = "INVALID_ARGS";
    CLIExitCode[CLIExitCode["NOT_FOUND"] = 3] = "NOT_FOUND";
})(CLIExitCode || (CLIExitCode = {}));

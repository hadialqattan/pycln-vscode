import { ExecException } from "child_process";

export enum ErrorType {
  moduleNotFound = "No module named pycln",
  configFileError = "Config file",
  nonPythonFile = "No Python files are present to be cleaned",
  syntaxError = "SyntaxError",
}


export function getErrorType(error: ExecException | null, stdout: string, stderr: string): ErrorType | null {
  if (error && error.message) {
    if (error.message.indexOf(ErrorType.moduleNotFound) > -1) {
      return ErrorType.moduleNotFound;
    }

    if (error.message.indexOf(ErrorType.configFileError) > -1) {
      return ErrorType.configFileError;
    }
  }

  if (stdout.indexOf(ErrorType.nonPythonFile) > -1) {
    return ErrorType.nonPythonFile;
  }

  if (stderr.indexOf(ErrorType.syntaxError) > -1) {
    return ErrorType.syntaxError;
  }
  
  return null;
}

export function isEqualERR(a: ErrorType | null, b: ErrorType): boolean {
  return a === b;
};

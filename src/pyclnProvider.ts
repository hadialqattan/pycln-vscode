import * as path from 'path';
import {exec} from 'child_process';
import {
  Uri,
  window,
  workspace,
  OutputChannel
} from 'vscode';

import {
  getErrorType,
  isEqualERR,
  ErrorType
} from './errors';
import { 
  replaceVarInPath,
  pyclnVersionIsIncompatible
} from './utils';


export interface PyclnConfig {
  pythonPath?: string;
  rootPath?: string;
  pyclnPath: string;
  configPath?: string;

  include?: string;
  exclude?: string;

  all: boolean;
  expandStars: boolean;
  noGitignore: boolean;
}

const REL_PATH_REGEX = /^[\.]{1,2}\//;

export class PyclnProvider {
  private channel?: OutputChannel;
  private commandPrefix: string;
  hasCompatiblePyclnVersion?: boolean;

  constructor(commandPrefix = ''){
    this.commandPrefix = commandPrefix;
  }

  debug(msg: string, newLine = true) {
    const debug: boolean = workspace.getConfiguration('pycln', null).get('extension.debug') as boolean;
    if (debug) {
        if (this.channel === undefined)
            {this.channel = window.createOutputChannel('Pycln – Unused import statements remover');}
        newLine ? this.channel.appendLine(msg) : this.channel.append(msg);
        this.channel.show();
    }
  }

  getConfig(resource: Uri | undefined): PyclnConfig {
    const pyclnConfig = workspace.getConfiguration('pycln', resource);
    const pythonConfig = workspace.getConfiguration('python', resource);
    const workspaceFolder = resource
      ? workspace.getWorkspaceFolder(resource)
      : workspace.workspaceFolders && workspace.workspaceFolders[0];

    const customPath = pyclnConfig.get('extension.path') as string;
    return {
      pythonPath: pythonConfig.get('pythonPath') as string | undefined,
      rootPath: workspaceFolder ? (workspaceFolder.uri.path as string): undefined,
      pyclnPath: customPath? customPath : "pycln",
      configPath: pyclnConfig.get('options.configPath') as string | undefined,

      include: pyclnConfig.get('options.include') as string | undefined,
      exclude: pyclnConfig.get('options.exclude') as string | undefined,

      all: pyclnConfig.get('flags.all') as boolean,
      expandStars: pyclnConfig.get('flags.expandStars') as boolean,
      noGitignore: pyclnConfig.get('flags.noGitignore') as boolean
    };
  }

  private getSources(isOneFile: boolean): string | undefined {
    let sources = window.activeTextEditor?.document.uri.fsPath;
    
    if (!isOneFile) {
      const folders = workspace.workspaceFolders;
      if (folders) {
        sources = "";
        for (const wf of folders) {
          sources += " " + wf.uri.fsPath;
        }
      }
    }
    return sources;
  }

  getCommand(isOneFile: boolean, {pythonPath, rootPath, pyclnPath, configPath, include, exclude, all, expandStars, noGitignore}: PyclnConfig) : string {
    // replace ${workspaceRoot} var in paths with rootPath
    if (rootPath) {
      pyclnPath = replaceVarInPath(pyclnPath, '${workspaceFolder}', rootPath);
      pyclnPath = replaceVarInPath(pyclnPath, '${workspaceRoot}', rootPath);
      if (pythonPath) {
          pythonPath = replaceVarInPath(pythonPath, '${workspaceFolder}', rootPath);
          pythonPath = replaceVarInPath(pythonPath, '${workspaceRoot}', rootPath);
      }
      if (configPath) {
        configPath = replaceVarInPath(configPath, '${workspaceFolder}', rootPath);
        configPath = replaceVarInPath(configPath, '${workspaceRoot}', rootPath);
      }
    }
    // convert relative pythonPath to absolute pythonPath based on current rootPath
    if (pythonPath && REL_PATH_REGEX.test(pythonPath) && rootPath)
        {pythonPath = path.join(rootPath, pythonPath);}
    // convert relative pyclnPath to absolute pyclnPath based on current rootPath
    if (REL_PATH_REGEX.test(pyclnPath) && rootPath) {pyclnPath = path.join(rootPath, pyclnPath);}
    // prefix command with python path from python extension when setting exists
    const hasCustomPath = pyclnPath !== 'pycln';
    const pythonPrefix =
        pythonPath && pythonPath !== 'python' && !hasCustomPath ? `${pythonPath} -m ` : '';

    {return `${this.commandPrefix}${pythonPrefix}${pyclnPath} ${this.getSources(isOneFile)}${configPath? " --config=" + configPath + " ": ""}${include?" --include=" +include + " ":""}${exclude? " --exclude=" + exclude + " ":""}${all ? ' --all ' : ''}${expandStars ? ' --expand-stars ' : ''}${noGitignore ? ' --no-gitignore ' : ''}`;}
  }

  //private getErrorType()

  private async provideFileFormat(isOneFile: boolean) {
    // handle incompatible pycln version
    if (!this.hasCompatiblePyclnVersion) {
      const versionErrorMessage = await pyclnVersionIsIncompatible(this);
      if (versionErrorMessage) {
          window.showErrorMessage(versionErrorMessage);
          return [];
      } else {
          this.hasCompatiblePyclnVersion = true;
      }
    }

    const config = this.getConfig(window.activeTextEditor?.document.uri);
    const command  = this.getCommand(isOneFile, config);

    let exitCode: number | null;
    exec(command, (error, stdout, stderr) => {
            const errorType = getErrorType(error, stdout, stderr);
            let isSuccess = exitCode === 0;
            this.debug(ErrorType.nonPythonFile);
            if (isSuccess && !errorType) {
                this.debug('Formatting applied successfully.');
            } else {
                // output status message
                if (exitCode === 250) {
                    // exit code 250 signifies and internal error, most likely unable to parse input
                    this.debug('Failed to format: unable to parse input.');
                    window.showErrorMessage('Failed to format: unable to parse a file.');
                } else if (exitCode === 127 || isEqualERR(errorType, ErrorType.moduleNotFound)) {
                    this.debug('Failed to format: "pycln" command not found.');
                    window.showErrorMessage(
                        'Command "pycln" not found. Try "pip install pycln".'
                    );
                } else if (isEqualERR(errorType, ErrorType.syntaxError)) {
                  this.debug("Pycln has encountered a syntax error.");
                } else if (isEqualERR(errorType, ErrorType.nonPythonFile)){
                  this.debug(`Failed to format: the current active window is not a Python file.`);
                  window.showErrorMessage(`Failed to format: the current active window is not a Python file.`);
                } else if (isEqualERR(errorType, ErrorType.configFileError)){
                  this.debug(`Failed to format: the provided config file is not valid, does not supported, or does not exits (file: ${config.configPath})`);
                  window.showErrorMessage(`Failed to format: the provided config file is not valid, does not supported, or does not exits (file: ${config.configPath})`);
                } else {
                    this.debug('Failed to format: unhandled error.');
                    window.showErrorMessage(
                        'Failed to format: unhandled error. Set "pycln.debug" to true to enable debugging output.'
                    );
                }
            }
            // log the command that was run
            this.debug(`Command "${command}" resulted in an exit code of ${exitCode}.`);
            // log error if any
            if (!isSuccess) {this.debug(`${error}`.trim());}
        }).on('exit', function(code) {
            // capture the exit code for use above
            exitCode = code;
        });
  }

  oneFileFormat() {
    this.provideFileFormat(true);
  }

  manyFilesFormat() {
    this.provideFileFormat(false);
  }
}

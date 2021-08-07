import * as path from 'path';
import {exec} from 'child_process';

import { PyclnProvider } from './pyclnProvider';

const minPyclnVersion: string = require("../package.json").minPyclnVersion;

export function replaceVarInPath(pathTemplate: string, searchValue: string, replaceValue: string) {
  // searchValue not present, early exit
  if (pathTemplate.indexOf(searchValue) === -1) {return pathTemplate;}

  const pathParts = pathTemplate.split(searchValue).reduce<string[]>((result, part, i, parts)=>{
    const isLastPart = i === parts.length - 1;
    return isLastPart? [...result, part]: [...result, part, replaceValue];
  }, []);

  // add back leading "./" when present in pathTemplate
  return `${pathTemplate.startsWith('./') ? './' : ''}${path.join(...pathParts)}`;
}

export class Version {
  major: number;
  minor: number;
  patch: number;

  constructor(version: string) {
    const matches = version.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!matches) {throw Error(`Invalid version string "${version}".`);}
    this.major = parseInt(matches[1]);
    this.minor = parseInt(matches[2]);
    this.patch = parseInt(matches[3]);
  }

  valueOf() {
    const { major, minor, patch } = this;
    return major * 1000000 + minor * 10000 + patch * 10;
  }

  toString() {
    const { major, minor, patch } = this;
    return `${major}.${minor}.${patch}`;
  }
}

export function pyclnVersionIsIncompatible(provider: PyclnProvider) {
  return new Promise<string | void>((resolve, reject) => {
    let exitCode: number | null;
    const checkVersionCmd = `${provider.getCommand(false, provider.getConfig(undefined))} --version`;
    exec(checkVersionCmd, (error, stdout, stderr) => {
      if (exitCode === 0) {
          try {
              const minVersion = new Version(minPyclnVersion);
              const envVersion = new Version(stdout);
              if (envVersion < minVersion) {
                  const versionErrorMessage = `Pycln v${envVersion} is no longer supported, v${minVersion} or greater is required. Try \`pip install -U pycln\`.`;
                  resolve(versionErrorMessage);
              }
          } catch {
              // pass
          }
      }
      resolve();
    }).on('exit', code => {
        exitCode = code;
    });
  });
}

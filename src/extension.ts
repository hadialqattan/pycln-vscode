import { exec } from 'child_process';
import {
  window, 
  commands,
  ExtensionContext
} from 'vscode';

import { PyclnProvider } from './pyclnProvider';
import { pyclnVersionIsIncompatible } from './utils';

export async function activate(context: ExtensionContext) {
  const providerArgs: string[] = [];

  // workaround for vscode issue: https://github.com/Microsoft/vscode/issues/16261
  if (process.platform === 'darwin' && !process.env.LANG) {
      await new Promise<void>((resolve, reject) =>
          exec(
              `echo $(defaults read -g AppleLanguages | sed '/"/!d;s/["[:space:]]//g;s/-/_/').UTF-8`,
              (error, stdout, stderr) => {
                  // if there's an unexpected error, skip this
                  if (!error) {
                      const langCode = stdout.trim();
                      // make sure stdout matches a valid language code pattern
                      if (langCode.match(/^[a-z]{2}_[A-Z]{2}\.UTF-8$/)) {
                          providerArgs.push(`LANG=${langCode} `);
                      }
                  }
                  resolve();
              }
          )
      );
  }

  const provider = new PyclnProvider(...providerArgs);

  // check pycln version compatibility
  const versionErrorMessage = await pyclnVersionIsIncompatible(provider);
  if (versionErrorMessage) {
      window.showErrorMessage(versionErrorMessage);
      provider.debug(versionErrorMessage);
      provider.hasCompatiblePyclnVersion = false;
  }

  context.subscriptions.push(commands.registerCommand('pycln.oneFile', () => {provider.oneFileFormat();}));
  context.subscriptions.push(commands.registerCommand('pycln.manyFiles', () => {provider.manyFilesFormat();}));
}

export function deactivate() {}

import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

import {Version} from '../../utils';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

  // TODO 2021-08-07: write tests...

  test('version comparison works correctly', () => {
    // test expected success
    const v1 = new Version('0.0.13');
    const v2 = new Version('0.1.0');
    const v3 = new Version('1.0.0');
    const v4 = new Version('1.0.1');
    assert(v1 < v2);
    assert(v2 < v3);
    assert(v3 < v4);
  });
});

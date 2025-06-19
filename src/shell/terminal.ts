import pty from 'node-pty';
import { EOL } from 'node:os';

import { IPC_CHANNELS } from '../constants';
import { AppWindow } from '../main-process/appWindow';
import { getDefaultShell } from './util';

/**
 * An in-app interactive terminal.
 *
 * Wraps a system shell and makes it available in the app.
 */
export class Terminal {
  #pty: pty.IPty | undefined;
  readonly #window: AppWindow;
  readonly #cwd: string;
  readonly #uvPath: string;

  readonly sessionBuffer: string[] = [];
  readonly size = { cols: 80, rows: 30 };

  get pty() {
    this.#pty ??= this.#createPty();
    return this.#pty;
  }

  constructor(window: AppWindow, cwd: string, uvPath: string) {
    this.#window = window;
    this.#cwd = cwd;
    this.#uvPath = uvPath;
  }

  write(data: string) {
    this.pty.write(data);
  }

  resize(cols: number, rows: number) {
    this.pty.resize(cols, rows);
    this.size.cols = cols;
    this.size.rows = rows;
  }

  restore() {
    return {
      buffer: this.sessionBuffer,
      size: this.size,
    };
  }

  #createPty() {
    const window = this.#window;
    // node-pty hangs when debugging - fallback to winpty
    // https://github.com/microsoft/node-pty/issues/490

    // Alternativelsy, insert a 500-1000ms timeout before the connect call:
    // node-pty/lib/windowsPtyAgent.js#L112
    const debugging = process.env.NODE_DEBUG === 'true';
    // TODO: does this want to be a setting?
    const shell = getDefaultShell();
    const instance = pty.spawn(shell, [], {
      useConpty: !debugging,
      handleFlowControl: false,
      conptyInheritCursor: false,
      name: 'xterm',
      cols: this.size.cols,
      rows: this.size.rows,
      cwd: this.#cwd,
    });

    if (process.platform === 'win32') {
      // PowerShell function
      instance.write(`function pip { & "${this.#uvPath}" pip $args }${EOL}`);
    } else {
      // Bash/Zsh alias
      instance.write(`alias pip='"${this.#uvPath}" pip'${EOL}`);
    }

    instance.onData((data) => {
      this.sessionBuffer.push(data);
      window.send(IPC_CHANNELS.TERMINAL_ON_OUTPUT, data);
      if (this.sessionBuffer.length > 1000) this.sessionBuffer.shift();
    });

    return instance;
  }
}

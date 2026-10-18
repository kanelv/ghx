import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface ScopedCredentialSession {
  helperScriptPath: string;
  socketPath: string;
  tempDir: string;
  cleanup: () => Promise<void>;
}

export async function createScopedCredentialSession(
  username: string,
  token: string,
): Promise<ScopedCredentialSession> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghx-cred-'));
  try {
    fs.chmodSync(tempDir, 0o700);
  } catch {
    // Ignore on filesystems that do not support POSIX chmod
  }

  const socketPath = path.join(tempDir, 'ghx.sock');
  const helperScriptPath = path.join(tempDir, 'helper.cjs');

  let server: net.Server | null = null;
  const activeSockets = new Set<net.Socket>();
  let isCleanedUp = false;

  const exitHandler = () => sigHandler();
  const sigHandler = (signal?: NodeJS.Signals) => {
    void cleanup();
    // Handlers suppress default termination; exit (runs 'exit' listeners, e.g. kill git).
    if (signal) process.exit(128 + os.constants.signals[signal]);
  };

  const cleanup = async (): Promise<void> => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    process.off('exit', exitHandler);
    process.off('SIGINT', sigHandler);
    process.off('SIGTERM', sigHandler);
    process.off('SIGHUP', sigHandler);

    for (const socket of activeSockets) {
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
    }
    activeSockets.clear();

    if (server) {
      try {
        server.close();
      } catch {
        // Ignore close errors
      }
      server = null;
    }

    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore removal errors
    }
  };

  process.once('exit', exitHandler);
  process.once('SIGINT', sigHandler);
  process.once('SIGTERM', sigHandler);
  process.once('SIGHUP', sigHandler);

  await new Promise<void>((resolve, reject) => {
    server = net.createServer((socket) => {
      activeSockets.add(socket);
      socket.once('close', () => {
        activeSockets.delete(socket);
      });

      let buffer = '';
      let handled = false;

      const handleQuery = () => {
        if (handled) return;
        handled = true;

        const lines = buffer.split(/\r?\n/);
        let protocol = '';
        let host = '';

        for (const line of lines) {
          const eqIdx = line.indexOf('=');
          if (eqIdx !== -1) {
            const key = line.slice(0, eqIdx).trim().toLowerCase();
            const val = line.slice(eqIdx + 1).trim();
            if (key === 'protocol') protocol = val.toLowerCase();
            if (key === 'host') host = val.toLowerCase();
          }
        }

        // Strictly verify this request is intended for HTTPS GitHub
        if (protocol === 'https' && host === 'github.com') {
          socket.write(`username=${username}\npassword=${token}\n`, () => {
            socket.end();
          });
        } else {
          socket.write('\n', () => {
            socket.end();
          });
        }
      };

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        if (buffer.includes('\n\n') || buffer.includes('\r\n\r\n')) {
          handleQuery();
        }
      });

      socket.on('end', () => {
        handleQuery();
      });

      socket.on('error', () => {
        socket.destroy();
      });
    });

    server.unref();

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(socketPath, () => {
      try {
        fs.chmodSync(socketPath, 0o600);
      } catch {
        // Ignore on platforms without socket chmod
      }
      resolve();
    });
  });

  // Write standalone executable helper script (CommonJS)
  const helperScriptCode = `#!/usr/bin/env node
const net = require('node:net');
const action = process.argv[2];

if (action === 'store' || action === 'erase') {
  process.exit(0);
}

if (action !== 'get') {
  process.exit(0);
}

const socketPath = ${JSON.stringify(socketPath)};
let inputData = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  inputData += chunk;
  if (inputData.includes('\\n\\n') || inputData.includes('\\r\\n\\r\\n')) {
    sendRequest();
  }
});

process.stdin.on('end', () => {
  sendRequest();
});

let requestSent = false;
function sendRequest() {
  if (requestSent) return;
  requestSent = true;

  const client = net.createConnection({ path: socketPath }, () => {
    client.write(inputData);
  });

  client.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  client.on('end', () => {
    process.exit(0);
  });

  client.on('error', () => {
    process.exit(1);
  });
}
`;

  fs.writeFileSync(helperScriptPath, helperScriptCode, {
    mode: 0o700,
    encoding: 'utf-8',
  });
  try {
    fs.chmodSync(helperScriptPath, 0o700);
  } catch {
    // Ignore
  }

  return {
    helperScriptPath,
    socketPath,
    tempDir,
    cleanup,
  };
}

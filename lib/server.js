import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import morgan from "morgan";
import qrcode from "qrcode-terminal";
import multer from "multer";

import constants from "./constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getInterfaceAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.entries(interfaces).forEach(([name, records]) => {
    (records || []).forEach(record => {
      if (record.family !== "IPv4" || record.internal) {
        return;
      }

      addresses.push({
        name,
        address: record.address
      });
    });
  });

  return addresses;
}

async function promptForInterface(addresses) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log("Choose the network interface you would like to use:");
    addresses.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.name} (${entry.address})`);
    });

    const answer = await rl.question(
      `Interface number [1-${addresses.length}, default 1]: `
    );
    const selectedIndex = Number.parseInt(answer.trim(), 10);

    if (
      Number.isNaN(selectedIndex) ||
      selectedIndex < 1 ||
      selectedIndex > addresses.length
    ) {
      return addresses[0].address;
    }

    return addresses[selectedIndex - 1].address;
  } finally {
    rl.close();
  }
}

async function getInterfaceAddress({ host, interfaceName } = {}) {
  if (host) {
    return host;
  }

  const addresses = getInterfaceAddresses();

  if (addresses.length === 0) {
    throw new Error("No non-internal IPv4 network interfaces were found.");
  }

  if (interfaceName) {
    const match = addresses.find(entry => entry.name === interfaceName);

    if (!match) {
      const available = addresses
        .map(entry => `${entry.name} (${entry.address})`)
        .join(", ");
      throw new Error(
        `Unknown interface "${interfaceName}". Available interfaces: ${available}`
      );
    }

    return match.address;
  }

  if (
    addresses.length === 1 ||
    !process.stdin.isTTY ||
    !process.stdout.isTTY
  ) {
    return addresses[0].address;
  }

  return promptForInterface(addresses);
}

function generateQRcode(url) {
  console.log(`\n\nURL: ${url}`);
  console.log("Scan the code below in order to proceed.");

  qrcode.generate(url, { small: true }, qr => {
    console.log(qr);
    console.log("Press Ctrl+c to cancel the transfer.\n\n");
  });
}

async function serve({
  source,
  action = constants.ACTION_TRANSFER,
  type = constants.TYPE_FILE,
  port = 0,
  host,
  interfaceName
}) {
  const app = express();
  const clave = crypto.randomUUID();
  const address = await getInterfaceAddress({ host, interfaceName });

  app.use(morgan("combined"));

  if (action === constants.ACTION_TRANSFER) {
    if (type === constants.TYPE_FILE) {
      app.get(`/${clave}`, (req, res) => {
        res.sendFile(source, err => {
          if (err) {
            console.error(`Failed to send file "${source}": ${err.message}`);

            if (!res.headersSent) {
              res.status(err.statusCode || 500).json({
                error: "Failed to send file."
              });
            }

            return;
          }

          console.log(`Sent file: ${source}`);
        });
      });
    }

    if (type === constants.TYPE_DIRECTORY) {
      throw new Error("Directory transfer is not implemented yet.");
    }
  } else if (action === constants.ACTION_RECEIVE) {
    app.use(`/${clave}`, express.static(path.join(__dirname, "public")));

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, source);
      },
      filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
      }
    });

    const upload = multer({
      storage
    });

    app.post(`/${clave}/upload`, upload.array("files"), (req, res) => {
      res.json({
        files: req.files.map(file => {
          delete file.buffer;
          return file;
        })
      });
    });
  }

  app.use((err, req, res, next) => {
    console.error(err.stack || err.message);

    if (res.headersSent) {
      next(err);
      return;
    }

    res.status(500).json({
      error: "Transfer failed."
    });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, address, () => {
      const live = `http://${server.address().address}:${
        server.address().port
      }/${clave}`;
      generateQRcode(live);
      resolve(server);
    });

    server.on("error", reject);
  });
}

export default serve;

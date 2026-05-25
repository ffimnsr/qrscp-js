#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { program } from "commander";
import envinfo from "envinfo";

import packageJson from "./package.json" with { type: "json" };
import serve from "./lib/server.js";
import constants from "./lib/constants.js";

function parsePort(value) {
  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${value}". Expected a number from 0 to 65535.`);
  }

  return port;
}

function reportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

function addServeOptions(command) {
  return command
    .option("-p, --port <port>", "port to use in serving the file", parsePort, 0)
    .option("-H, --host <host>", "bind to a specific host or IPv4 address")
    .option("-i, --interface <name>", "bind to the first IPv4 address on a specific interface");
}

program
  .name("qrscp")
  .version(packageJson.version)
  .option("--verbose", "print additional logs")
  .option("--info", "print environment debug info")
  .showHelpAfterError()
  .on("--help", () => {
    console.log();
    console.log(`If you have any problems, do not hesitate to file an issue:`);
    console.log(`  ${chalk.cyan("https://github.com/ffimnsr/qrscp")}`);
    console.log();
  });

addServeOptions(
  program.command("transfer <file>")
  .description("transfer the given file")
).action(async (file, options) => {
  const source = path.resolve(file);

  try {
    const stats = await fs.stat(source);

    if (stats.isDirectory()) {
      throw new Error(
        `Directory transfer is not supported yet: ${source}\nPass a file instead.`
      );
    }

    if (!stats.isFile()) {
      throw new Error(`Unsupported transfer source: ${source}`);
    }

    await serve({
      source,
      port: options.port,
      host: options.host,
      interfaceName: options.interface
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      reportError(`File not found: ${source}`);
      return;
    }

    reportError(error);
  }
})
  .on("--help", () => {
    console.log();
    console.log("Examples:");
    console.log("  qrscp transfer profile.png");
    console.log("  qrscp transfer --port 8080 profile.png");
    console.log("  qrscp transfer --interface en0 profile.png");
    console.log("  qrscp transfer --host 192.168.1.10 profile.png");
    console.log();
  });

addServeOptions(
  program.command("receive <directory>")
  .description("receive the transferred file to the given directory")
).action(async (directory, options) => {
  const source = path.resolve(directory);

  try {
    const stats = await fs.stat(source);

    if (stats.isFile()) {
      throw new Error(`Specify a directory to receive files: ${source}`);
    }

    if (!stats.isDirectory()) {
      throw new Error(`Unsupported receive destination: ${source}`);
    }

    await serve({
      action: constants.ACTION_RECEIVE,
      source,
      port: options.port,
      host: options.host,
      interfaceName: options.interface
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      reportError(`Directory not found: ${source}`);
      return;
    }

    reportError(error);
  }
});

program.on("command:*", function() {
  console.error(
    "Invalid command: %s\nSee --help for list of available commands",
    program.args.join(" ")
  );
});

program.parse(process.argv);

const globalOptions = program.opts();

if (globalOptions && typeof globalOptions.info !== "undefined" && globalOptions.info) {
  console.log(`\n${chalk.bold("Environment Info:")}`);
  envinfo
    .run(
      {
        System: ["OS", "CPU"],
        Binaries: ["Node", "npm", "Yarn"],
        Browsers: ["Chrome", "Edge", "Internet Explorer", "Firefox", "Safari"],
        npmGlobalPackages: ["qrscp"]
      },
      {
        duplicates: true,
        showNotFound: true
      }
    )
    .then(console.log);
}

if (program && program.args.length === 0) {
  program.help();
}

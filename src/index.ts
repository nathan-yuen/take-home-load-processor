import fs from "fs";
import readline from "readline";
import yargs from "yargs";
import EntryRepo from "./lib/CustomerRecords";
import Logger from "./lib/Logger";
import { Entry, Result } from "./types/types";

const argv = yargs.options({
  input: {
    alias: "i",
    type: "string",
    default: "input.txt",
  },
  output: {
    alias: "o",
    type: "string",
    default: "output.txt",
  },
  debug: {
    alias: "d",
    type: "boolean",
    default: false,
  },
}).argv;

if (!argv.input) {
  console.log("Please profile input entries!");
  process.exit(1);
}

global.debug = argv.debug;

const lineReader = readline.createInterface({
  input: fs.createReadStream(argv.input),
});

const results: Result[] = [];

lineReader.on("line", (line) => {
  const trimmedLine = line.trim();
  if (trimmedLine) {
    let entry: Entry;
    try {
      entry = JSON.parse(trimmedLine);
    } catch {
      Logger.log(`Unable to parse: ${trimmedLine}`);
      return;
    }

    const result = EntryRepo.consumeEntry(entry);
    if (result) {
      results.push(result);
    }
  }
});

lineReader.on("close", () => {
  const writeStream = fs.createWriteStream(argv.output);
  results.forEach((entry) => {
    writeStream.write(JSON.stringify(entry));
    writeStream.write("\n");
  });
  writeStream.end();
});

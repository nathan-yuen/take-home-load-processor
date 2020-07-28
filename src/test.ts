import fs from "fs";
import readline from "readline";
import test from "ava";
import CustomerRecordsRepo from "./lib/CustomerRecords";
import {
  Entry,
  RichEntry,
  Result,
  ValidationResult,
  CustomerRecord,
} from "./types/types";
import { ZonedDateTime } from "@js-joda/core";

const {
  getRecord,
  toParsedEntry,
  validateEntry,
  clearRecords,
} = CustomerRecordsRepo.testables;

const {
  DAILY_MAX_COUNT,
  DAILY_LIMIT,
  WEEKLY_LIMIT,
} = CustomerRecordsRepo.constants;

const baseRecord = {
  balance: 0,
  last_loaded: null,
  load_ids: new Set<string>(),
  today_count: 0,
  today_total: 0,
  weekly_total: 0,
};

const lastLoadTime = ZonedDateTime.parse("2020-01-01T10:01:01Z"); // WED
const loadTimeString = "2020-01-01T14:01:01Z";
const loadTime = ZonedDateTime.parse(loadTimeString); // WED

test.beforeEach((t) => {
  clearRecords();
});

test("Entry parsing", (t) => {
  const entryLine =
    '{"id":"11441","customer_id":"562","load_amount":"$3260.20","time":"2000-01-28T16:48:20Z"}';
  const entry: Entry = JSON.parse(entryLine);
  const parseEntry: RichEntry = toParsedEntry(entry);

  t.is(parseEntry.id, entry.id);
  t.is(parseEntry.customer_id, entry.customer_id);
  t.is(`$${parseEntry.load_amount.toFixed(2)}`, entry.load_amount);
  t.is(parseEntry.time.toString(), entry.time);
});

test(`Load count > daily limit (${DAILY_MAX_COUNT})`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: 1,
    time: loadTime,
  };

  const result: ValidationResult = validateEntry(entry, {
    ...baseRecord,
    last_loaded: lastLoadTime,
    today_count: DAILY_MAX_COUNT,
  });
  t.is(result.accepted, false);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Single load amount > daily limit (${DAILY_LIMIT})`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: DAILY_LIMIT + 1,
    time: loadTime,
  };

  const result: ValidationResult = validateEntry(entry, baseRecord);
  t.is(result.accepted, false);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Single load amount > weekly limit (${WEEKLY_LIMIT})`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: WEEKLY_LIMIT + 1,
    time: loadTime,
  };

  const result: ValidationResult = validateEntry(entry, baseRecord);
  t.is(result.accepted, false);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Initial load`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: 1,
    time: loadTime,
  };

  const result: ValidationResult = validateEntry(entry, baseRecord);
  t.is(result.accepted, true);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Same day load amount > daily limit (${DAILY_LIMIT})`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: DAILY_LIMIT / 2 + 1,
    time: loadTime,
  };

  const result: ValidationResult = validateEntry(entry, {
    ...baseRecord,
    today_count: 1,
    today_total: DAILY_LIMIT / 2,
    last_loaded: lastLoadTime,
  });
  t.is(result.accepted, false);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Same week load amount > weekly limit (${WEEKLY_LIMIT})`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: WEEKLY_LIMIT / 2 + 1,
    time: lastLoadTime.plusDays(1),
  };

  const result: ValidationResult = validateEntry(entry, {
    ...baseRecord,
    weekly_total: WEEKLY_LIMIT / 2,
    last_loaded: lastLoadTime,
  });
  t.is(result.accepted, false);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, undefined);
});

test(`Load on the next day`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: 1,
    time: lastLoadTime.plusDays(1),
  };

  const result: ValidationResult = validateEntry(entry, {
    ...baseRecord,
    last_loaded: lastLoadTime,
  });
  t.is(result.accepted, true);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, true);
  t.is(result.isNewWeek, undefined);
});

test(`Load on the next week`, (t) => {
  const entry: RichEntry = {
    id: "0",
    customer_id: "0",
    load_amount: 1,
    time: lastLoadTime.plusWeeks(1),
  };

  const result: ValidationResult = validateEntry(entry, {
    ...baseRecord,
    last_loaded: lastLoadTime,
  });
  t.is(result.accepted, true);
  t.is(result.ignored, undefined);
  t.is(result.isNewDay, undefined);
  t.is(result.isNewWeek, true);
});

test(`Get empty record`, (t) => {
  const record = getRecord("");

  t.is(record.balance, baseRecord.balance);
  t.is(record.load_ids.size, baseRecord.load_ids.size);
  t.is(record.last_loaded, baseRecord.last_loaded);
  t.is(record.today_count, baseRecord.today_count);
  t.is(record.today_total, baseRecord.today_total);
  t.is(record.weekly_total, baseRecord.weekly_total);
});

test(`Get record`, (t) => {
  const entry: Entry = {
    id: "0",
    customer_id: "0",
    load_amount: "$1",
    time: loadTimeString,
  };

  const result: Result = CustomerRecordsRepo.consumeEntry(entry);

  t.is(result.id, entry.id);
  t.is(result.customer_id, entry.customer_id);
  t.is(result.accepted, true);

  const record: CustomerRecord = getRecord(entry.customer_id);

  t.is(record.balance, 1);
  t.assert(record.load_ids.has("0"));
  t.is(record.load_ids.size, 1);
  t.is(record.last_loaded.toString(), loadTimeString);
  t.is(record.today_count, 1);
  t.is(record.today_total, 1);
  t.is(record.weekly_total, 1);
});

test(`Sample input`, async (t) => {
  const inputReader = readline.createInterface({
    input: fs.createReadStream("input.txt"),
  });

  const sampleOutputReader = readline.createInterface({
    input: fs.createReadStream("sample-output.txt"),
  });

  // Collect all processed entries
  const actualPromise: Promise<string[]> = new Promise((resolve) => {
    const lines: string[] = [];
    inputReader.on("line", (line) => {
      const entry = JSON.parse(line);
      const result = CustomerRecordsRepo.consumeEntry(entry);

      if (result) {
        lines.push(JSON.stringify(result));
      }
    });

    inputReader.on("close", () => resolve(lines));
  });

  // Collect all line from sample output
  const expectedPromise: Promise<string[]> = new Promise((resolve) => {
    const lines: string[] = [];
    sampleOutputReader.on("line", (line) => lines.push(line));
    sampleOutputReader.on("close", () => resolve(lines));
  });

  const actualLines = await actualPromise;
  const expectedLines = await expectedPromise;

  t.is(actualLines.length, expectedLines.length);
  t.deepEqual(actualLines, expectedLines);
});

import { ChronoUnit, ZonedDateTime } from "@js-joda/core";
import Logger from "./Logger";

import {
  CustomerRecord,
  Entry,
  RichEntry,
  Result,
  ValidationResult,
} from "../types/types";

const DAILY_MAX_COUNT = 3;

const DAILY_LIMIT = 5000;

const WEEKLY_LIMIT = 20000;

const CURRENCY_REGEX = /\$(\d*.\d*)/;

const customerRecords = new Map<string, CustomerRecord>();

// Return existing customer record if available, or create a new one
function getRecord(customerId: string): CustomerRecord {
  const record = customerRecords.get(customerId);
  return (
    record || {
      balance: 0,
      last_loaded: null,
      load_ids: new Set<string>(),
      today_count: 0,
      today_total: 0,
      weekly_total: 0,
    }
  );
}

// Transform Entry with parsed load amount & rich timestamp
function toRichEntry(entry: Entry) {
  const { id, customer_id, load_amount, time } = entry;
  const parsedAmount = Number.parseFloat(load_amount.match(CURRENCY_REGEX)[1]);

  return {
    customer_id,
    id,
    load_amount: parsedAmount,
    time: ZonedDateTime.parse(time),
  };
}

// Validate entry against existing customer record
function validateEntry(
  entry: RichEntry,
  record: CustomerRecord
): ValidationResult {
  const { id, load_amount, time } = entry;
  const {
    last_loaded,
    load_ids,
    today_count,
    today_total,
    weekly_total,
  } = record;

  // Check if load id already exists for current customer
  if (load_ids.has(id)) {
    Logger.log(`[Ignored] Load id (${id}) already exisits for this customer`);
    return { ignored: true };
  }

  // Check if load amount alone is within limits
  if (load_amount > DAILY_LIMIT || load_amount > WEEKLY_LIMIT) {
    Logger.log("[Rejected] Load amount has exceeded daily / weekly limit");
    return { accepted: false };
  }

  // First load for current customer, no further validation required
  if (last_loaded === null) {
    Logger.log("[Accepted] Initial load");
    return { accepted: true };
  }

  // Generate cut off time for today and this week based on previous load time
  const nextStartOfDay = last_loaded.plusDays(1).truncatedTo(ChronoUnit.DAYS);
  const nextStartOfWeek = last_loaded
    .plusWeeks(1)
    .minusDays(last_loaded.dayOfWeek().value() - 1)
    .truncatedTo(ChronoUnit.DAYS);

  // Ensure load time is after previous load time
  if (time.isAfter(last_loaded)) {
    // If load time is within this week
    if (time.isBefore(nextStartOfWeek)) {
      // Check if load amount is within weekly limit
      if (weekly_total + load_amount > WEEKLY_LIMIT) {
        Logger.log("[Rejected] Load amount has exceeded weekly limit");
        return { accepted: false };
      }      
      Logger.log("Load amount within weekly limit");
    } else {
      // Load time is after this week, which implies first load of the day
      Logger.log("[Accepted] First load of the week");
      return {
        accepted: true,
        isNewWeek: true
      };
    }
    
    let isNewDay: boolean | undefined;

    // If load time is within today
    if (time.isBefore(nextStartOfDay)) {
      // Check if load count already reached limit
      if (today_count === DAILY_MAX_COUNT) {
        Logger.log("[Rejected] Number of loads has exceeded daily limit");
        return { accepted: false };
        
      // Check if load amount is within daily limit
      } else if (today_total + load_amount > DAILY_LIMIT) {
        Logger.log("[Rejected] Load amount has exceeded daily limit");
        return { accepted: false };
      }
      Logger.log("[Accepted] Load amount within daily limit");
    } else {
      // Load time is after today
      Logger.log("[Accepted] First load of the day");
      isNewDay = true;
    }

    return {
      accepted: true,
      isNewDay
    };
  } else {
    // Load time is in the past
    Logger.log("[Rejected] Load time is before last load");
    return { accepted: false };
  }
}

function consumeEntry(entry: Entry): Result | undefined {
  // Parse entry
  const parsed = toRichEntry(entry);
  const { id, customer_id, load_amount, time } = parsed;

  // Get exisitng customer record
  const record = getRecord(entry.customer_id);
  const { balance, load_ids, today_count, today_total, weekly_total } = record;

  Logger.log("=========");
  Logger.log(`ID: ${id}`);
  Logger.log(`customerId: ${customer_id}`);
  Logger.log(`time: ${time.toString()}`);
  Logger.log(`amount: ${load_amount}`);

  Logger.log(`todayCount: ${today_count}`);
  Logger.log(`todayTotal: ${today_total}`);
  Logger.log(`weeklyTotal: ${weekly_total}`);

  // Validate entry against customer record
  const { accepted, ignored, isNewDay, isNewWeek } = validateEntry(
    parsed,
    record
  );

  // Append load id to the set regardless of result
  const loadIds = new Set<string>(load_ids);
  loadIds.add(id);

  if (accepted) {
    // Update record, adjust various counts
    customerRecords.set(customer_id, {
      balance: balance + load_amount,
      load_ids: loadIds,
      last_loaded: time,
      today_count: isNewDay || isNewWeek ? 1 : today_count + 1,
      today_total: isNewDay || isNewWeek ? load_amount : today_total + load_amount,
      weekly_total: isNewWeek ? load_amount : weekly_total + load_amount,
    });

    return { id, customer_id, accepted: true };
  } else {
    customerRecords.set(customer_id, {
      ...record,
      load_ids: loadIds,
    });

    return ignored ? undefined : { id, customer_id, accepted: false };
  }
}

// For clearing records, testing purpose
function clearRecords() {
  customerRecords.clear();
}

export default {
  consumeEntry,
  testables: {
    getRecord,
    toParsedEntry: toRichEntry,
    validateEntry,
    clearRecords,
  },
  constants: {
    DAILY_MAX_COUNT,
    DAILY_LIMIT,
    WEEKLY_LIMIT,
  },
};

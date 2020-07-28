import { ZonedDateTime } from "@js-joda/core";

export interface CustomerRecord {
  balance: number;
  today_total: number;
  today_count: number;
  weekly_total: number;
  last_loaded: ZonedDateTime;
  load_ids: Set<string>;
}

export interface Entry {
  id: string;
  customer_id: string;
  load_amount: string;
  time: string;
}

export interface RichEntry {
  id: string;
  customer_id: string;
  load_amount: number;
  time: ZonedDateTime;
}

export interface ValidationResult {
  accepted?: boolean;
  ignored?: boolean;
  isNewDay?: boolean;
  isNewWeek?: boolean;
}

export interface Result {
  id: string;
  customer_id: string;
  accepted: boolean;
}

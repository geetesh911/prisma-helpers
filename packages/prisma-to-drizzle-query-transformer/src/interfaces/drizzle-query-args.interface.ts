import { SQL } from "drizzle-orm";
import { UnknownRecord } from "./unknown-record.interface";

export interface DrizzleQueryArgs {
    where?: SQL<unknown>;
    with?: UnknownRecord;
    offset?: number;
    limit?: number;
    orderBy?: SQL<unknown>[];
    columns?: Record<string, boolean>;
}
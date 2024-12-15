import { UnknownRecord } from "./unknown-record.interface";

export interface ParseOperatorsArgs {
    operatorObject: UnknownRecord | UnknownRecord[];
    operator: string;
    operatorValue: string | string[] | null;
    fieldOrJoinOperator: string;
}
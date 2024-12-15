import { PgTable, SelectedFieldsFlat, TableConfig } from 'drizzle-orm/pg-core';
import {
  AnyColumn,
  BinaryOperator,
  Column,
  SQL,
  SQLWrapper,
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notInArray,
  notLike,
  or,
} from 'drizzle-orm';
import { UnknownRecord } from '../interfaces/unknown-record.interface';
import { DrizzleQueryArgs } from 'src/interfaces/drizzle-query-args.interface';
import { ParseOperatorsArgs } from 'src/interfaces/parse-operators-args.interface';

export class PrismaToDrizzleTransformer<
  T extends UnknownRecord = UnknownRecord,
  K extends PgTable<TableConfig> = PgTable<TableConfig>
> {
  public readonly model: K;

  constructor(model: K) {
    this.model = model;
  }

  transformQuery(args: T): DrizzleQueryArgs {
    const response: UnknownRecord = {};

    if (args.where) {
      response.where = this.parseWhere(args.where as UnknownRecord);
    }

    if (args.include) {
      response.with = this.parseInclude(args.include as UnknownRecord);
    }

    if (args.select) {
      response.columns = args.select;
    }

    if (args.take) {
      response.limit = args.take;
    }

    if (args.skip) {
      response.offset = args.skip;
    }

    if (args.orderBy) {
      const argsOrderByArrayValue = !Array.isArray(args.orderBy)
        ? [args.orderBy]
        : args.orderBy;

      response.orderBy = argsOrderByArrayValue.flatMap((orderByArg) =>
        Object.entries(orderByArg).map(([key, value]) => {
          const property = this.model[
            key as keyof PgTable<TableConfig>
          ] as Column;

          if (!property) {
            throw new Error(`Invalid orderBy field: ${key}`);
          }

          return value === 'asc' ? asc(property) : desc(property);
        })
      );
    }

    if (args.cursor) {
      const [[key, value]] = Object.entries(args.cursor);
      const { where, limit, orderBy } = this.withCursorPagination({
        where: response.where as SQL<unknown>,
        limit: response.limit as number,
        cursors: [
          [
            this.model['createdAt' as keyof PgTable<TableConfig>] as Column,
            args.orderBy?.['createdAt' as keyof typeof args.orderBy] ?? 'asc',
            (args.cursor as UnknownRecord).createdAt,
          ],
          [
            this.model[key as keyof PgTable<TableConfig>] as Column,
            args.orderBy?.[key as keyof typeof args.orderBy] ?? 'asc',
            value,
          ],
        ],
      });

      response.where = where;
      response.limit = limit;
      response.orderBy = orderBy;
    }

    return response;
  }

  parseWhere(where: UnknownRecord): SQL<unknown> | undefined {
    return and(
      ...Object.entries(where).map(([identifier, value]) => {
        const property = this.model[
          identifier as keyof PgTable<TableConfig>
        ] as Column;

        switch (true) {
          case value === null: {
            if (!property) {
              throw new Error(`Invalid where field: ${identifier}`);
            }

            return isNull(property);
          }

          case typeof value === 'object' &&
            value?.constructor.name === 'Object': {
            const filteredObjectKeys = ['mode'];
            const operators = Object.entries(value).flatMap(([key, _value]) => {
              if (filteredObjectKeys.includes(key)) {
                return [];
              }

              return [
                this.parseOperators({
                  operatorObject: value as UnknownRecord,
                  operator: key,
                  operatorValue: _value,
                  fieldOrJoinOperator: identifier,
                }),
              ];
            });

            if (operators.length === 1) {
              return operators[0];
            }

            if (identifier === 'OR') {
              return or(...operators);
            }

            return and(...operators);
          }

          case Array.isArray(value): {
            return this.parseOperators({
              operatorObject: value,
              operator: identifier,
              operatorValue: value,
              fieldOrJoinOperator: identifier,
            });
          }

          case value === undefined:
            return undefined;

          default: {
            if (!property) {
              throw new Error(`Invalid where field: ${identifier}`);
            }

            return eq(property, value);
          }
        }
      })
    );
  }

  parseInclude(include: UnknownRecord): UnknownRecord {
    const response: UnknownRecord = {};

    for (const [key, value] of Object.entries(include)) {
      if (typeof value === 'object') {
        response[key] = this.transformQuery(value as T);
      } else {
        response[key] = value;
      }
    }

    return response;
  }

  parseSelect(select: UnknownRecord): SelectedFieldsFlat {
    const response: UnknownRecord = {};

    for (const [key, value] of Object.entries(select)) {
      if (typeof value === 'object') {
        throw new Error('Nested select is not supported');
      } else if (value) {
        response[key] = this.model[key as keyof PgTable<TableConfig>] as Column;
      }
    }

    return response as SelectedFieldsFlat;
  }

  withCursorPagination<
    PrimaryColumn extends AnyColumn,
    // Make sure the secondary column is from the same table as the primary column:
    TableColumns extends PrimaryColumn['table']['_']['columns'],
    SecondaryColumn extends TableColumns[keyof TableColumns],
    PrimaryCursor extends
      | ReturnType<PrimaryColumn['mapFromDriverValue']>
      | undefined,
    SecondaryCursor extends
      | ReturnType<SecondaryColumn['mapFromDriverValue']>
      | undefined,
    Order extends 'asc' | 'desc'
  >({
    cursors,
    limit,
    where: inputWhere,
  }: { limit: number; where?: SQL } & (
    | {
        cursors: [
          [PrimaryColumn, Order] | [PrimaryColumn, Order, PrimaryCursor]
        ]; // A single unique + sequential field
      }
    | {
        cursors: [
          [PrimaryColumn, Order] | [PrimaryColumn, Order, PrimaryCursor], // A non-unique sequential field
          [SecondaryColumn, Order] | [SecondaryColumn, Order, SecondaryCursor] // A unique field
        ];
      }
  )): {
    orderBy: SQL[];
    limit: number;
    where?: SQL;
  } {
    // Primary cursor
    const primaryColumn = cursors[0][0];
    const primaryOrder = cursors[0][1] === 'asc' ? asc : desc;
    const primaryOperator = cursors[0][1] === 'asc' ? gt : lt;
    const primaryCursor = cursors[0][2];

    // Secondary cursor (unique fallback like an id field for a stable sort)
    const secondaryColumn = cursors[1] ? cursors[1][0] : null;
    const getSecondaryOrderAndOperator = (): [
      (column: AnyColumn | SQLWrapper) => SQL,
      BinaryOperator
    ] => (cursors[1]?.[1] === 'asc' ? [asc, gt] : [desc, lt]);
    const [secondaryOrder, secondaryOperator] = cursors[1]
      ? getSecondaryOrderAndOperator()
      : [null, null];
    const secondaryCursor = cursors[1] ? cursors[1][2] : undefined;

    // Single cursor pagination
    const singleColumnPaginationWhere =
      typeof primaryCursor !== 'undefined'
        ? primaryOperator(primaryColumn, primaryCursor)
        : undefined;

    // Double cursor pagination
    const doubleColumnPaginationWhere =
      secondaryColumn &&
      secondaryOperator &&
      typeof primaryCursor !== 'undefined' &&
      typeof secondaryCursor !== 'undefined'
        ? or(
            primaryOperator(primaryColumn, primaryCursor),
            and(
              eq(primaryColumn, primaryCursor),
              secondaryOperator(secondaryColumn, secondaryCursor)
            )
          )
        : undefined;

    // Generate the final where clause
    const paginationWhere = secondaryColumn
      ? doubleColumnPaginationWhere
      : singleColumnPaginationWhere;
    const getWhere = (): SQL<unknown> | undefined =>
      paginationWhere ? and(inputWhere, paginationWhere) : inputWhere;
    const where = inputWhere ? getWhere() : paginationWhere;

    // Return object which can be easily spread into a query
    return {
      orderBy: [
        primaryOrder(primaryColumn),
        ...(secondaryColumn && secondaryOrder
          ? [secondaryOrder(secondaryColumn)]
          : []),
      ],
      limit,
      ...(where ? { where } : {}),
    };
  }

  private parseOperators({
    operatorObject,
    operator,
    operatorValue,
    fieldOrJoinOperator,
  }: ParseOperatorsArgs): SQLWrapper | SQL<unknown> | undefined {
    const isLogicalOperator =
      operator === 'AND' || operator === 'OR' || operator === 'NOT';

    if (isLogicalOperator) {
      if (!Array.isArray(operatorObject)) {
        operatorObject = [operatorObject];
      }

      let joinOperator = and;

      if (fieldOrJoinOperator === 'OR') {
        joinOperator = or;
      }

      return joinOperator(
        ...operatorObject.map((v) =>
          fieldOrJoinOperator === 'NOT'
            ? not(this.parseWhere(v) as SQLWrapper)
            : this.parseWhere(v)
        )
      );
    }

    const property = this.model[
      fieldOrJoinOperator as keyof PgTable<TableConfig>
    ] as Column;

    if (!property) {
      throw new Error(`Invalid field: ${fieldOrJoinOperator}`);
    }

    const selectedOperatorFunction = this.operatorMap(
      {
        operatorObject,
        operator,
        operatorValue,
        fieldOrJoinOperator,
      },
      property
    )[operator as keyof typeof this.operatorMap];

    if (!selectedOperatorFunction) {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    return selectedOperatorFunction();
  }

  private readonly operatorMap = (
    {
      operatorObject,
      operator,
      operatorValue,
      fieldOrJoinOperator,
    }: ParseOperatorsArgs,
    property: Column
  ): Record<string, () => SQLWrapper | SQL<unknown>> => ({
    not: (): SQLWrapper | SQL<unknown> => {
      if (operatorValue === null) {
        return isNotNull(property);
      } else if (typeof operatorValue === 'object') {
        return not(
          this.parseOperators({
            operatorObject,
            operator,
            operatorValue,
            fieldOrJoinOperator,
          }) as SQLWrapper
        );
      }

      return not(eq(property, operatorValue));
    },
    in: (): SQLWrapper | SQL<unknown> => {
      if (Array.isArray(operatorValue)) {
        return inArray(property, operatorValue);
      }

      throw new Error("Value for 'in' operator must be an array");
    },
    notIn: (): SQLWrapper | SQL<unknown> => {
      if (Array.isArray(operatorValue)) {
        return notInArray(property, operatorValue);
      }

      throw new Error("Value for 'notIn' operator must be an array");
    },
    lt: (): SQLWrapper | SQL<unknown> => {
      if (fieldOrJoinOperator === 'NOT') {
        return not(lt(property, operatorValue));
      }

      return lt(property, operatorValue);
    },
    lte: (): SQLWrapper | SQL<unknown> => {
      if (fieldOrJoinOperator === 'NOT') {
        return not(lte(property, operatorValue));
      }

      return lte(property, operatorValue);
    },
    gt: (): SQLWrapper | SQL<unknown> => {
      if (fieldOrJoinOperator === 'NOT') {
        return not(gt(property, operatorValue));
      }

      return gt(property, operatorValue);
    },
    gte: (): SQLWrapper | SQL<unknown> => {
      if (fieldOrJoinOperator === 'NOT') {
        return not(gte(property, operatorValue));
      }

      return gte(property, operatorValue);
    },
    contains: (): SQLWrapper | SQL<unknown> => {
      const mode = (operatorObject as UnknownRecord)?.mode;

      if (Array.isArray(operatorValue)) {
        throw new Error("Value for 'contains' operator must be a string");
      }

      if (operatorValue === null) {
        throw new Error("Value for 'contains' operator must be a string");
      }

      if (fieldOrJoinOperator === 'NOT') {
        if (mode === 'insensitive') {
          return notIlike(property, operatorValue);
        }

        return notLike(property, operatorValue);
      }

      if (mode === 'insensitive') {
        return ilike(property, operatorValue);
      }

      return like(property, operatorValue);
    },
    equals: (): SQLWrapper | SQL<unknown> => {
      if (fieldOrJoinOperator === 'NOT') {
        return ne(property, operatorValue);
      }

      return eq(property, operatorValue);
    },
    has: (): SQLWrapper | SQL<unknown> => {
      return arrayContains(property, operatorValue);
    },
    hasEvery: (): SQLWrapper | SQL<unknown> => {
      return arrayContained(property, operatorValue);
    },
    hasSome: (): SQLWrapper | SQL<unknown> => {
      return arrayOverlaps(property, operatorValue);
    },
  });
}

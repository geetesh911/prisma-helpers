import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { PrismaToDrizzleTransformer } from '../prisma-to-drizzle-query-transformer';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  jsonb,
} from 'drizzle-orm/pg-core';
import { UnknownRecord } from '../../interfaces/unknown-record.interface';

describe('PrismaToDrizzleTransformer', () => {
  const mockModel = pgTable('Product', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sku: text('sku'),
    subtitle: text('subtitle'),
    description: text('description'),
    isGiftCard: boolean('isGiftCard').default(false).notNull(),
    status: text('status').default('DRAFT').notNull(),
    weight: doublePrecision('weight'),
    length: doublePrecision('length'),
    height: doublePrecision('height'),
    width: doublePrecision('width'),
    originCountry: text('originCountry'),
    hsCode: text('hsCode'),
    midCode: text('midCode'),
    material: text('material'),
    isDiscountable: boolean('isDiscountable').default(true).notNull(),
    isRecommended: boolean('isRecommended').default(false).notNull(),
    externalId: text('externalId'),
    metadata: jsonb('metadata'),
    typeId: text('typeId'),
    deletedAt: timestamp('deletedAt', { mode: 'date', precision: 3 }),
    createdAt: timestamp('createdAt', { mode: 'date', precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date', precision: 3 })
      .defaultNow()
      .notNull(),
  });
  let transformer: PrismaToDrizzleTransformer<UnknownRecord, typeof mockModel>;

  beforeEach(() => {
    const model = mockModel;
    transformer = new PrismaToDrizzleTransformer(model);
  });

  describe('transformQuery', () => {
    it('should transform where clause', () => {
      const args = { where: { id: '123' } };
      const result = transformer.transformQuery(args);
      expect(result.where).toBeDefined();
    });

    it('should transform include clause', () => {
      const args = { include: { metadata: true } };
      const result = transformer.transformQuery(args);
      expect(result.with).toEqual({ metadata: true });
    });

    it('should transform select clause', () => {
      const args = { select: { id: true, name: true } };
      const result = transformer.transformQuery(args);
      expect(result.columns).toEqual(args.select);
    });

    it('should transform take clause', () => {
      const args = { take: 10 };
      const result = transformer.transformQuery(args);
      expect(result.limit).toEqual(10);
    });

    it('should transform skip clause', () => {
      const args = { skip: 5 };
      const result = transformer.transformQuery(args);
      expect(result.offset).toEqual(5);
    });

    it('should transform orderBy clause', () => {
      const args = { orderBy: { createdAt: 'asc' } };
      const result = transformer.transformQuery(args);
      expect(result.orderBy).toEqual([asc(transformer.model['createdAt'])]);
    });

    it('should transform cursor clause', () => {
      const args = {
        where: { deletedAt: null },
        cursor: { id: '123' },
        take: 2,
        orderBy: { id: 'asc' },
      };
      const result = transformer.transformQuery(args);

      expect(result.where).toBeDefined();
      expect(result.limit).toBeDefined();
      expect(result.orderBy).toBeDefined();
    });

    it('should transform nested where clause', () => {
      const args = { where: { AND: [{ id: '123' }, { status: 'active' }] } };
      const result = transformer.transformQuery(args);
      expect(result.where).toEqual(expect.objectContaining({}));
    });

    it('should transform multiple orderBy fields', () => {
      const args = { orderBy: [{ createdAt: 'asc' }, { id: 'desc' }] };
      const result = transformer.transformQuery(args);
      expect(result.orderBy).toBeDefined();
    });

    it('should transform complex include clause', () => {
      const args = {
        include: { metadata: true, type: { select: { name: true } } },
      };
      const result = transformer.transformQuery(args);
      expect(result).toEqual(
        expect.objectContaining({
          with: {
            metadata: true,
            type: { columns: { name: true } },
          },
        })
      );
    });
  });

  describe('parseWhere', () => {
    it('should parse where clause with null value', () => {
      const where = { id: null };
      const result = transformer.parseWhere(where);
      expect(result).toEqual(and(isNull(transformer.model['id'])));
    });

    it('should parse where clause with object value', () => {
      const where = { id: { equals: '123' } };
      const result = transformer.parseWhere(where);
      expect(result).toEqual(and(eq(transformer.model['id'], '123')));
    });

    it('should parse where clause with array value', () => {
      const where = { id: { in: ['123', '456'] } };
      const result = transformer.parseWhere(where);
      expect(result).toEqual(
        and(inArray(transformer.model['id'], ['123', '456']))
      );
    });

    it('should parse nested where clause', () => {
      const where = { AND: [{ id: '123' }, { status: 'active' }] };
      const result = transformer.parseWhere(where);
      expect(result).toEqual(expect.objectContaining({}));
    });
  });

  describe('parseInclude', () => {
    it('should parse include clause', () => {
      const include = { metadata: true };
      const result = transformer.parseInclude(include);
      expect(result).toEqual({ metadata: true });
    });

    it('should parse complex include clause', () => {
      const include = { metadata: true, type: { select: { name: true } } };
      const result = transformer.parseInclude(include);
      expect(result).toEqual(
        expect.objectContaining({
          metadata: true,
          type: { columns: { name: true } },
        })
      );
    });
  });

  describe('parseSelect', () => {
    it('should parse select clause', () => {
      const select = { id: true, name: true };
      const result = transformer.parseSelect(select);
      expect(result).toEqual({
        id: transformer.model['id'],
        name: transformer.model['name'],
      });
    });
  });

  describe('withCursorPagination', () => {
    it('should handle single cursor pagination', () => {
      const args: Parameters<typeof transformer.withCursorPagination>[0] = {
        cursors: [[transformer.model['id'], 'asc', '123']],
        limit: 10,
        where: eq(transformer.model['status'], 'active'),
      };
      const result = transformer.withCursorPagination(args);
      expect(result.orderBy).toEqual([asc(transformer.model['id'])]);
      expect(result.limit).toEqual(10);
      expect(result.where).toBeDefined();
    });

    it('should handle double cursor pagination', () => {
      const args: Parameters<typeof transformer.withCursorPagination>[0] = {
        cursors: [
          [transformer.model['createdAt'], 'asc', new Date()],
          [transformer.model['id'], 'asc', '123'],
        ],
        limit: 10,
        where: eq(transformer.model['status'], 'active'),
      };
      const result = transformer.withCursorPagination(args);
      expect(result.orderBy).toEqual([
        asc(transformer.model['createdAt']),
        asc(transformer.model['id']),
      ]);
      expect(result.limit).toEqual(10);
      expect(result.where).toBeDefined();
    });

    it('should handle complex cursor pagination', () => {
      const args: Parameters<typeof transformer.withCursorPagination>[0] = {
        cursors: [
          [transformer.model['createdAt'], 'asc', new Date()],
          [transformer.model['id'], 'asc', '123'],
        ],
        limit: 10,
        where: and(
          eq(transformer.model['status'], 'active'),
          isNull(transformer.model['deletedAt'])
        ),
      };
      const result = transformer.withCursorPagination(args);
      expect(result.orderBy).toEqual([
        asc(transformer.model['createdAt']),
        asc(transformer.model['id']),
      ]);
      expect(result.limit).toEqual(10);
      expect(result.where).toEqual(expect.objectContaining({}));
    });
  });
});

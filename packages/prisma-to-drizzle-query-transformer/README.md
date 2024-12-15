# Prisma to Drizzle Query Transformer

The `PrismaToDrizzleTransformer` is a utility that transforms Prisma query objects into Drizzle ORM query objects. This allows you to leverage the powerful querying capabilities of Drizzle ORM while using the familiar Prisma query syntax.

## Features

- **Transform Prisma `where` clauses**: Convert complex Prisma `where` conditions into Drizzle ORM compatible queries.
- **Support for `include` and `select`**: Handle Prisma's `include` and `select` clauses to fetch related data and specific fields.
- **Pagination**: Support for `take` (limit) and `skip` (offset) for pagination.
- **Order By**: Convert Prisma `orderBy` clauses into Drizzle ORM's sorting functions.
- **Cursor-based Pagination**: Implement cursor-based pagination for efficient data retrieval.

## Installation

To install the package, use npm or yarn:

```bash
npm install prisma-to-drizzle-query-transformer
# or
yarn add prisma-to-drizzle-query-transformer
# or
pnpm add prisma-to-drizzle-query-transformer
```

## Usage

### Basic Usage

```typescript
import { PrismaToDrizzleTransformer } from 'prisma-to-drizzle-query-transformer';
import { myDrizzleModel } from './my-drizzle-model';

const transformer = new PrismaToDrizzleTransformer(myDrizzleModel);

const prismaQuery = {
  where: {
    name: 'John Doe',
    age: { gt: 30 },
  },
  include: {
    posts: true,
  },
  select: {
    id: true,
    name: true,
  },
  take: 10,
  skip: 5,
  orderBy: {
    createdAt: 'desc',
  },
};

const drizzleQuery = transformer.transformQuery(prismaQuery);
console.log(drizzleQuery);
```

### Handling `where` Clauses

The `where` clause in Prisma can be transformed to Drizzle ORM's `where` clause using the `transformQuery` method.

```typescript
const prismaWhere = {
  where: {
    name: 'John Doe',
    age: { gt: 30 },
  },
};

const drizzleWhere = transformer.transformQuery(prismaWhere);
console.log(drizzleWhere);
```

### Including Related Data

You can include related data using the `include` clause.

```typescript
const prismaInclude = {
  include: {
    posts: true,
  },
};

const drizzleInclude = transformer.transformQuery(prismaInclude);
console.log(drizzleInclude);
```

### Selecting Specific Fields

Use the `select` clause to fetch specific fields.

```typescript
const prismaSelect = {
  select: {
    id: true,
    name: true,
  },
};

const drizzleSelect = transformer.transformQuery(prismaSelect);
console.log(drizzleSelect);
```

### Pagination

You can use `take` and `skip` for pagination.

```typescript
const prismaPagination = {
  take: 10,
  skip: 5,
};

const drizzlePagination = transformer.transformQuery(prismaPagination);
console.log(drizzlePagination);
```

### Ordering Results

The `orderBy` clause can be used to sort results.

```typescript
const prismaOrderBy = {
  orderBy: {
    createdAt: 'desc',
  },
};

const drizzleOrderBy = transformer.transformQuery(prismaOrderBy);
console.log(drizzleOrderBy);
```

### Cursor-based Pagination

For efficient pagination, you can use cursor-based pagination.

```typescript
const prismaCursor = {
  cursor: {
    id: 1,
  },
  orderBy: {
    createdAt: 'asc',
  },
};

const drizzleCursor = transformer.transformQuery(prismaCursor);
console.log(drizzleCursor);
```

## Unsupported Features

- `where` clauses within `include` properties are not supported. For example:
  ```typescript
    const prismaQuery = {
        include: {
            type: {
                where: { deletedAt: null }, # Not Supported
            },
        }
    }
  ```

## Error Handling

The transformer will throw errors for unsupported operators or invalid query structures. Ensure your Prisma queries are correctly structured and supported by the transformer.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the MIT License.

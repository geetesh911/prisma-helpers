# Prisma Helpers

A collection of utilities and helpers for working with Prisma and Drizzle ORM.

## Packages

- **prisma-to-drizzle-query-transformer**: Transforms Prisma queries to Drizzle ORM queries.

## Usage

### Prisma to Drizzle Query Transformer

This package provides a transformer to convert Prisma queries to Drizzle ORM queries.

## Installation

To install the packages, run:

```bash
npm install @geetesh911/prisma-to-drizzle-query-transformer
```

#### Example

```typescript
import { PrismaToDrizzleTransformer } from '@geetesh911/prisma-to-drizzle-query-transformer';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  jsonb,
} from 'drizzle-orm/pg-core';

const mockModel = pgTable('Product', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ...other fields...
});

const transformer = new PrismaToDrizzleTransformer(mockModel);

const prismaQuery = {
  where: { id: '123' },
  select: { id: true, name: true },
};

const drizzleQuery = transformer.transformQuery(prismaQuery);
console.log(drizzleQuery);
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Buy Me a Coffee

If you like this project, please consider buying me a coffee!

<a href="https://www.buymeacoffee.com/geetesh911" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

This project is licensed under the MIT License.

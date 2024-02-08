import { drawingSchema } from '../src/index.js';
import { schema, collection } from '@verdant-web/store';

const drawings = collection({
  name: 'drawing',
  primaryKey: 'id',
  fields: {
    id: {
      type: 'string',
      default: () => Math.random().toString(36).substring(7),
    },
    drawing: drawingSchema,
  },
});

export default schema({
  version: 1,
  collections: {
    drawings,
  },
});

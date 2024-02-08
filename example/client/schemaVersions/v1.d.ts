import { StorageSchema } from "@verdant-web/common";
declare const schema: StorageSchema;
export default schema;

export type DrawingSnapshot = { id: string; drawing: DrawingDrawingSnapshot };

export type DrawingDrawingSnapshot = { store: any | null; schema: any | null };
export type DrawingInit = { id?: string; drawing: DrawingDrawingInit };

export type DrawingDrawingInit = { store?: any | null; schema?: any | null };

export type MigrationTypes = {
  drawings: { init: DrawingInit; snapshot: DrawingSnapshot };
};

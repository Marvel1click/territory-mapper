import { toTypedRxJsonSchema, ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';

// Territory Collection Schema
export const territorySchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    name: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    congregation_id: {
      type: 'string',
    },
    boundary: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'Polygon' },
        coordinates: {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
            },
          },
        },
      },
    },
    center: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    status: {
      type: 'string',
      enum: ['in-stock', 'out', 'pending'],
      default: 'in-stock',
    },
    color: {
      type: 'string',
      default: '#3b82f6',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
    created_by: {
      type: 'string',
    },
  },
  required: ['id', 'name', 'congregation_id', 'boundary', 'center', 'created_at', 'updated_at', 'created_by'],
  indexes: ['congregation_id', 'status', 'created_at'],
} as const;

const _typedTerritorySchema = toTypedRxJsonSchema(territorySchemaLiteral);
export type TerritoryDocument = ExtractDocumentTypeFromTypedRxJsonSchema<typeof _typedTerritorySchema>;
export const territorySchema: RxJsonSchema<TerritoryDocument> = territorySchemaLiteral;

// House Collection Schema
export const houseSchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    territory_id: {
      type: 'string',
    },
    congregation_id: {
      type: 'string',
    },
    address: {
      type: 'string',
    },
    coordinates: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    status: {
      type: 'string',
      enum: ['not-visited', 'nah', 'interest', 'return-visit', 'dnc'],
      default: 'not-visited',
    },
    notes: {
      type: 'string',
    },
    is_dnc: {
      type: 'boolean',
      default: false,
    },
    dnc_encrypted_address: {
      type: 'string',
    },
    last_visited: {
      type: 'string',
      format: 'date-time',
    },
    last_visitor: {
      type: 'string',
    },
    return_visit_date: {
      type: 'string',
      format: 'date-time',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'territory_id', 'congregation_id', 'address', 'coordinates', 'created_at', 'updated_at'],
  indexes: ['territory_id', 'congregation_id', 'status', 'is_dnc', 'coordinates'],
} as const;

const _typedHouseSchema = toTypedRxJsonSchema(houseSchemaLiteral);
export type HouseDocument = ExtractDocumentTypeFromTypedRxJsonSchema<typeof _typedHouseSchema>;
export const houseSchema: RxJsonSchema<HouseDocument> = houseSchemaLiteral;

// Assignment Collection Schema
export const assignmentSchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    territory_id: {
      type: 'string',
    },
    publisher_id: {
      type: 'string',
    },
    publisher_name: {
      type: 'string',
    },
    congregation_id: {
      type: 'string',
    },
    checked_out_at: {
      type: 'string',
      format: 'date-time',
    },
    checked_out_by: {
      type: 'string',
    },
    due_date: {
      type: 'string',
      format: 'date-time',
    },
    returned_at: {
      type: 'string',
      format: 'date-time',
    },
    status: {
      type: 'string',
      enum: ['active', 'returned', 'overdue'],
      default: 'active',
    },
    qr_token: {
      type: 'string',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'territory_id', 'publisher_id', 'publisher_name', 'congregation_id', 'checked_out_at', 'checked_out_by', 'created_at', 'updated_at'],
  indexes: ['territory_id', 'publisher_id', 'congregation_id', 'status', 'checked_out_at'],
} as const;

const _typedAssignmentSchema = toTypedRxJsonSchema(assignmentSchemaLiteral);
export type AssignmentDocument = ExtractDocumentTypeFromTypedRxJsonSchema<typeof _typedAssignmentSchema>;
export const assignmentSchema: RxJsonSchema<AssignmentDocument> = assignmentSchemaLiteral;

// Sync State Collection Schema
export const syncStateSchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    collection: {
      type: 'string',
    },
    last_sync: {
      type: 'string',
      format: 'date-time',
    },
    pending_changes: {
      type: 'number',
      default: 0,
    },
    sync_status: {
      type: 'string',
      enum: ['idle', 'syncing', 'error'],
      default: 'idle',
    },
  },
  required: ['id', 'collection'],
} as const;

const _typedSyncStateSchema = toTypedRxJsonSchema(syncStateSchemaLiteral);
export type SyncStateDocument = ExtractDocumentTypeFromTypedRxJsonSchema<typeof _typedSyncStateSchema>;
export const syncStateSchema: RxJsonSchema<SyncStateDocument> = syncStateSchemaLiteral;

import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'overseer', 'publisher']);
export const membershipStatusSchema = z.enum(['active', 'suspended', 'removed']);
export const opaqueTokenSchema = z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/);

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: userRoleSchema,
});

export const acceptInviteSchema = z.object({ token: opaqueTokenSchema });

export const updateMemberSchema = z
  .object({
    userId: z.uuid(),
    role: userRoleSchema.optional(),
    status: membershipStatusSchema.optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'A role or status change is required.',
  });

export const createCheckoutLinkSchema = z.object({
  territoryId: z.string().trim().min(1).max(100),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export const assignTerritorySchema = z.object({
  territoryId: z.string().trim().min(1).max(100),
  publisherId: z.uuid(),
  dueDate: z.iso.datetime().nullable().optional(),
  mutationId: z.uuid().default(() => crypto.randomUUID()),
});

export const redeemCheckoutSchema = z.object({
  token: opaqueTokenSchema,
  mutationId: z.uuid().default(() => crypto.randomUUID()),
});

export const returnAssignmentSchema = z.object({
  mutationId: z.uuid().default(() => crypto.randomUUID()),
});

export const visitOutcomeSchema = z.enum([
  'not-home',
  'contacted',
  'interested',
  'return-visit',
  'do-not-call',
]);

export const createVisitSchema = z.object({
  id: z.string().trim().min(1).max(100),
  houseId: z.string().trim().min(1).max(100),
  territoryId: z.string().trim().min(1).max(100),
  outcome: visitOutcomeSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
  visitedAt: z.iso.datetime(),
  followUpAt: z.iso.datetime().nullable().optional(),
  mutationId: z.uuid(),
});

export const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(z.array(coordinatesSchema).min(4))
    .min(1)
    .refine(
      (rings) => rings.every((ring) => {
        const first = ring[0];
        const last = ring.at(-1);
        return first?.[0] === last?.[0] && first?.[1] === last?.[1];
      }),
      'Every polygon ring must be closed.',
    ),
});

export const createTerritorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  boundary: polygonSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2f6f4e'),
});

export const updateTerritorySchema = createTerritorySchema
  .extend({ status: z.enum(['in-stock', 'out', 'pending']).optional() })
  .partial()
  .extend({ version: z.number().int().min(1) })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'version'),
    'At least one change is required.',
  );

export const createHouseSchema = z.object({
  territory_id: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(500),
  coordinates: coordinatesSchema,
  status: z.enum(['not-visited', 'nah', 'interest', 'return-visit']).default('not-visited'),
  notes: z.string().trim().max(2000).nullable().optional(),
  is_dnc: z.boolean().default(false),
});

export const houseImportRowSchema = z
  .object({
    row: z.number().int().positive(),
    address: z.string().trim().min(1).max(500),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isDnc: z.boolean().default(false),
  })
  .refine(
    (value) => (value.latitude == null) === (value.longitude == null),
    'Latitude and longitude must be supplied together.',
  );

export const geocodePreviewSchema = z.object({
  rows: z.array(houseImportRowSchema).min(1).max(100),
});

export const importHousesSchema = z.object({
  territoryId: z.string().trim().min(1).max(100),
  rows: z.array(houseImportRowSchema.safeExtend({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })).min(1).max(500),
});

export const updateHouseSchema = z
  .object({
    address: z.string().trim().min(1).max(500).optional(),
    coordinates: coordinatesSchema.optional(),
    status: z.enum(['not-visited', 'nah', 'interest', 'return-visit']).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one change is required.');

export const upsertDncSchema = z.object({
  houseId: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(2000).nullable().optional(),
  warningRadiusM: z.number().int().min(5).max(500).default(35),
});

export const syncCheckpointSchema = z.object({
  server_updated_at: z.iso.datetime(),
  id: z.string().max(100).regex(/^[A-Za-z0-9_-]*$/),
});

export const replicationPullSchema = z.object({
  collection: z.enum(['territories', 'houses', 'assignments', 'visits']),
  checkpoint: syncCheckpointSchema.nullable().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export const replicationWriteRowSchema = z.object({
  newDocumentState: z.record(z.string(), z.unknown()),
  assumedMasterState: z.record(z.string(), z.unknown()).nullable(),
});

export const replicationPushSchema = z.object({
  collection: z.enum(['territories', 'houses', 'assignments', 'visits']),
  rows: z.array(replicationWriteRowSchema).min(1).max(100),
});

export const clientErrorSchema = z.object({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  route: z.string().trim().max(200).optional(),
  requestId: z.uuid().optional(),
});

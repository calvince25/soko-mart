import { z } from "zod";

const positiveId = z.number().int().positive();
const pagination = z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) });

export const warehouseStatusSchema = z.enum(["active", "inactive", "maintenance"]);
export const intakeStatusSchema = z.enum(["awaiting_intake", "received", "verification_required", "verified", "discrepancy", "rejected"]);
export const warehousePackageStatusSchema = z.enum(["received", "verification_required", "verified", "discrepancy", "rejected", "sorted", "dispatch_ready"]);
export const discrepancyTypeSchema = z.enum(["missing_item", "excess_item", "damaged_package", "wrong_item", "incomplete_shipment", "packaging_problem"]);
export const discrepancyResolutionStatusSchema = z.enum(["open", "in_review", "resolved", "rejected"]);
export const sortingBatchStatusSchema = z.enum(["open", "sorting", "sorted", "dispatch_ready", "closed"]);

export const warehouseIdSchema = z.object({ warehouseId: positiveId });
export const warehouseListSchema = pagination.extend({ status: warehouseStatusSchema.optional() });
export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
  country: z.string().trim().min(2).max(80).default("Kenya"),
  county: z.string().trim().min(2).max(120),
  town: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(500),
  status: warehouseStatusSchema.default("active"),
});
export const warehouseUpdateSchema = warehouseIdSchema.extend({
  name: z.string().trim().min(2).max(160).optional(),
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  county: z.string().trim().min(2).max(120).optional(),
  town: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().min(3).max(500).optional(),
  status: warehouseStatusSchema.optional(),
}).refine((input) => Object.keys(input).some((key) => key !== "warehouseId"), { message: "At least one warehouse field is required." });

export const intakeListSchema = pagination.extend({ warehouseId: positiveId.optional(), status: intakeStatusSchema.optional(), orderNumber: z.string().trim().min(5).max(40).optional(), sellerOrderId: positiveId.optional() });
export const receiveIntakeSchema = z.object({ sellerOrderId: positiveId, warehouseId: positiveId, packageCount: z.number().int().positive().max(1000), receivedItemCount: z.number().int().positive().optional(), notes: z.string().trim().max(1000).optional() });
export const intakeIdSchema = z.object({ intakeId: positiveId });

const packageItemSchema = z.object({ orderItemId: positiveId, quantity: z.number().int().positive().max(100000) });
export const packageCreateSchema = z.object({ intakeId: positiveId, items: z.array(packageItemSchema).min(1).max(100), weightGrams: z.number().int().positive().max(1000000).optional(), lengthMm: z.number().int().positive().max(100000).optional(), widthMm: z.number().int().positive().max(100000).optional(), heightMm: z.number().int().positive().max(100000).optional(), notes: z.string().trim().max(1000).optional() });
export const packageIdSchema = z.object({ packageId: positiveId });
export const packageListSchema = pagination.extend({ warehouseId: positiveId.optional(), status: warehousePackageStatusSchema.optional(), packageReference: z.string().trim().min(5).max(32).optional(), sellerOrderId: positiveId.optional(), destinationCounty: z.string().trim().min(2).max(120).optional() });
export const packageMetadataSchema = packageIdSchema.extend({ weightGrams: z.number().int().positive().max(1000000).optional(), lengthMm: z.number().int().positive().max(100000).optional(), widthMm: z.number().int().positive().max(100000).optional(), heightMm: z.number().int().positive().max(100000).optional() }).refine((input) => Object.keys(input).some((key) => key !== "packageId"), { message: "At least one package field is required." });

export const verifyPackageSchema = packageIdSchema;
export const verifyIntakeSchema = intakeIdSchema;
export const discrepancyCreateSchema = z.object({ intakeId: positiveId, packageId: positiveId.optional(), orderItemId: positiveId.optional(), type: discrepancyTypeSchema, description: z.string().trim().min(3).max(2000), quantity: z.number().int().positive().max(100000).default(1) });
export const discrepancyListSchema = pagination.extend({ warehouseId: positiveId.optional(), intakeId: positiveId.optional(), packageId: positiveId.optional(), resolutionStatus: discrepancyResolutionStatusSchema.optional() });
export const discrepancyResolveSchema = z.object({ discrepancyId: positiveId, resolutionStatus: z.enum(["in_review", "resolved", "rejected"]), resolutionNote: z.string().trim().max(2000).optional() });

const destination = z.object({ destinationCountry: z.string().trim().min(2).max(80), destinationCounty: z.string().trim().min(2).max(120), destinationTown: z.string().trim().min(2).max(120), destinationZone: z.string().trim().max(120).optional(), deliveryMethod: z.string().trim().max(80).optional() });
export const sortingBatchCreateSchema = destination.extend({ warehouseId: positiveId });
export const sortingBatchListSchema = pagination.extend({ warehouseId: positiveId.optional(), status: sortingBatchStatusSchema.optional(), destinationCounty: z.string().trim().min(2).max(120).optional() });
export const sortingBatchIdSchema = z.object({ batchId: positiveId });
export const sortingBatchPackageSchema = z.object({ batchId: positiveId, packageId: positiveId });
export const warehouseEventListSchema = pagination.extend({ warehouseId: positiveId, entityType: z.enum(["intake", "package", "batch"]).optional(), entityId: positiveId.optional() });
export const warehouseAssignmentCreateSchema = z.object({ warehouseId: positiveId, assigneeUserId: positiveId });
export const warehouseAssignmentListSchema = warehouseIdSchema;
export const warehouseDashboardSchema = z.object({ warehouseId: positiveId.optional() });

export type WarehouseStatus = z.infer<typeof warehouseStatusSchema>;
export type IntakeStatus = z.infer<typeof intakeStatusSchema>;
export type WarehousePackageStatus = z.infer<typeof warehousePackageStatusSchema>;
export type SortingBatchStatus = z.infer<typeof sortingBatchStatusSchema>;

export { idSchema, paginationSchema, permissionCodeSchema, roleCodeSchema, sortDirectionSchema, uuidSchema } from "../../shared/validation/schemas";
export { validationError } from "../../shared/errors/appError";

export function parseWithSchema<T>(schema: { parse: (value: unknown) => T }, input: unknown): T {
  return schema.parse(input);
}

// Esquemas de validación de entrada de la API.
import { z } from "zod";

export const driverSchema = z.enum(["price", "gain_amount", "gain_percent"]);

export const simulationSchema = z.object({
  product_code: z.string().min(1),
  price_list_code: z.string().min(1),
  query_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cost: z.string().nullable(),
  ideal_percent: z.string().nullable(),
  driver: driverSchema,
  driver_value: z.string().min(1),
  source_inactive: z.boolean().default(false),
  source_unknown: z.boolean().default(false),
});
export type SimulationPayload = z.infer<typeof simulationSchema>;

export const exportSchema = z.object({
  query_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price_list_code: z.string().min(1),
  simulations: z.record(z.string(), simulationSchema).optional(),
});

export const signUploadSchema = z.object({
  filename: z.string().min(1).max(255),
});

export const importPathSchema = z.object({
  path: z.string().min(1),
});

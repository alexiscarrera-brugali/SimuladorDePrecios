import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresá un correo válido"),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres"),
});

export const simulationSchema = z.object({
  product_code: z.string().min(1),
  price_list_code: z.string().min(1),
  query_date: z.string().date(),
  cost: z.string().nullable(),
  ideal_percent: z.string().nullable(),
  driver: z.enum(["price", "gain_amount", "gain_percent"]),
  driver_value: z.string(),
  source_inactive: z.boolean(),
  source_unknown: z.boolean(),
});

export type SimulationPayload = z.infer<typeof simulationSchema>;

export const correctionSchema = z.object({
  product_code: z.string().min(1),
  price_list_code: z.string().min(1),
  corrections: z.array(z.object({
    field: z.enum(["cost", "ideal_percent"]),
    original_value: z.string().nullable(),
    corrected_value: z.string().nullable(),
  })).min(1),
});

export type CorrectionPayload = z.infer<typeof correctionSchema>;

export const batchSchema = z
  .object({
    price_list_code: z.string().min(1),
    query_date: z.string().date(),
    rule_kind: z.enum(["to_target", "price_delta_pct", "cost_shock_pct"]),
    rule_value: z.string().nullable(),
    product_codes: z.array(z.string().min(1)).min(1, "Elegí al menos un producto"),
    note: z.string().max(500).optional(),
    save: z.boolean().default(false),
  })
  .refine(
    (data) =>
      data.rule_kind === "to_target" ||
      (data.rule_value !== null && data.rule_value.trim() !== "" && !Number.isNaN(Number(data.rule_value))),
    { message: "La regla necesita un porcentaje válido", path: ["rule_value"] },
  );

export type BatchPayload = z.infer<typeof batchSchema>;

const productRef = z.object({
  product_code: z.string().min(1),
  branch_code: z.string().min(1),
});

export const publishSchema = z.object({
  price_list_code: z.string().min(1),
  query_date: z.string().date(),
  items: z
    .array(productRef.extend({
      price: z.string().refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Precio inválido"),
    }))
    .min(1, "Elegí al menos un producto"),
});
export type PublishPayload = z.infer<typeof publishSchema>;

export const resetSchema = z.object({
  price_list_code: z.string().min(1),
  items: z.array(productRef).min(1, "Elegí al menos un producto"),
});
export type ResetPayload = z.infer<typeof resetSchema>;

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


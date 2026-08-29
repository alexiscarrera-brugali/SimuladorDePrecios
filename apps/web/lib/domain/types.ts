import type { Decimal } from "./decimal";

export type Driver = "price" | "gain_amount" | "gain_percent";
export type Thermometer = "green" | "red" | "neutral";
export type SourceStatus = "active" | "inactive" | "unknown";

/** Error de negocio con código estable (para traducción en la UI). */
export class EngineError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "EngineError";
  }
}

export interface SimulationInput {
  cost: Decimal | null;
  driver: Driver;
  driverValue: Decimal;
  idealPercent?: Decimal | null;
  sourceInactive?: boolean;
  sourceUnknown?: boolean;
}

export interface SimulationResult {
  price: Decimal | null;
  gainAmount: Decimal | null;
  gainPercent: Decimal | null;
  idealAmount: Decimal | null;
  idealPrice: Decimal | null;
  gapAmount: Decimal | null;
  gapPercentagePoints: Decimal | null;
  thermometer: Thermometer;
  warnings: string[];
}

export interface EffectiveCandidate {
  value: Decimal | null;
  /** Fecha de vigencia en ISO (YYYY-MM-DD). */
  validFrom: string;
  sourceRow: number;
  batchId?: string | null;
  sourceStatus: SourceStatus;
  /** 'import' (planilla) o 'manual' (establecido como vigente). */
  origin?: string | null;
}

export interface EffectiveValue {
  value: Decimal | null;
  validFrom: string | null;
  status: "ok" | "warning" | "conflict" | "missing";
  candidates: EffectiveCandidate[];
  warnings: string[];
  /** Origen del valor vigente elegido: 'import' | 'manual' | null. */
  origin: string | null;
}

import { z } from "zod";

// Money and quantities cross every boundary as decimal strings. A JS number never
// carries a dollar amount between packages.
export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "expected a decimal string such as \"12.50\"");
export type DecimalString = z.infer<typeof DecimalString>;

export const NonNegativeDecimal = DecimalString.refine((v) => !v.startsWith("-"), {
  message: "must be non-negative",
});

// Exchange order and instrument ids can exceed 2^53. Keep them as strings.
export const ExchangeId = z.string().regex(/^\d+$/);

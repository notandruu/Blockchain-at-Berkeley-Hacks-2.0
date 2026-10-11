import { z } from "zod";

// PRD section 10: every fact the merchant sees is one of these three. An inference can
// never be promoted to "source" without a stored evidence row.
export const Provenance = z.enum(["merchant", "source", "inference"]);
export type Provenance = z.infer<typeof Provenance>;

export const Sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    provenance: Provenance,
    evidenceIds: z.array(z.string()).default([]),
  });

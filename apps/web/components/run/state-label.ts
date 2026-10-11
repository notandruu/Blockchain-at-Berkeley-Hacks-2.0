// Conservative labels. "Protected" never appears before a reconciled fill.
export function stateLabel(state: string): { text: string; tone: "neutral" | "ok" | "warn" | "bad" | "sky" | "dark" } {
  switch (state) {
    case "DRAFT":
    case "RESEARCHING":
      return { text: "Researching", tone: "sky" };
    case "NEEDS_INPUT":
      return { text: "Needs input", tone: "warn" };
    case "MATCHING":
    case "QUOTING":
      return { text: "Evaluating", tone: "sky" };
    case "AWAITING_APPROVAL":
      return { text: "Awaiting approval", tone: "warn" };
    case "NO_EXECUTABLE_MATCH":
      return { text: "No executable match", tone: "neutral" };
    case "APPROVED":
      return { text: "Funds reserved", tone: "neutral" };
    case "SUBMITTING":
      return { text: "Order submitted", tone: "neutral" };
    case "RECONCILING":
      return { text: "Confirming fills", tone: "neutral" };
    case "EXECUTION_UNKNOWN":
      return { text: "Execution unknown", tone: "bad" };
    case "NO_FILL":
      return { text: "No fill", tone: "neutral" };
    case "ACTIVE":
    case "MONITORING":
      return { text: "Hedge confirmed", tone: "ok" };
    case "PAUSED":
      return { text: "Enrollment paused", tone: "warn" };
    case "FAILED":
      return { text: "Failed", tone: "bad" };
    default:
      return { text: state.toLowerCase().replaceAll("_", " "), tone: "neutral" };
  }
}

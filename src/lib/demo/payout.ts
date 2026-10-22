export type Seat = 0 | 1 | 2;
export type DemoStatus = "ready" | "denied" | "paid";

export interface DemoEvent {
  id: number;
  text: string;
  tone: "plain" | "refused" | "approved" | "paid";
}

export interface DemoState {
  approvals: [boolean, boolean, boolean];
  status: DemoStatus;
  attempts: number;
  events: DemoEvent[];
}

export type DemoAction = { type: "approve"; seat: Seat } | { type: "collect" } | { type: "reset" };

export function initialDemoState(): DemoState {
  return {
    approvals: [false, false, false],
    status: "ready",
    attempts: 0,
    events: [{ id: 0, text: "The fund proposed paying Hoa Binh Hospital. The family's file remains private.", tone: "plain" }],
  };
}

const SEAT_NAMES = ["Fund lead", "Local Red Cross", "Donor representative"] as const;

export function advanceDemo(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") return initialDemoState();
  if (state.status === "paid") return state;

  if (action.type === "approve") {
    if (state.approvals[action.seat]) return state;
    const approvals: DemoState["approvals"] = [...state.approvals];
    approvals[action.seat] = true;
    const count = approvals.filter(Boolean).length;
    return {
      ...state,
      approvals,
      status: count >= 2 ? "ready" : state.status,
      events: [...state.events, {
        id: state.events.length,
        text: `${SEAT_NAMES[action.seat]} approved. ${count >= 2 ? "The hospital can now request payment." : "One more independent approval is required."}`,
        tone: "approved",
      }],
    };
  }

  const count = state.approvals.filter(Boolean).length;
  const paid = count >= 2;
  return {
    ...state,
    status: paid ? "paid" : "denied",
    attempts: state.attempts + 1,
    events: [...state.events, {
      id: state.events.length,
      text: paid
        ? "Mock bank paid 50,000,000 VND directly to Hoa Binh Hospital. A public receipt appeared."
        : `Mock bank refused payment: ${count} of 2 required council approvals.`,
      tone: paid ? "paid" : "refused",
    }],
  };
}

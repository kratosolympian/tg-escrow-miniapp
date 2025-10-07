export const ESCROW_STATUS = {
  CREATED: "created",
  WAITING_PAYMENT: "waiting_payment",
  WAITING_ADMIN: "waiting_admin",
  PAYMENT_CONFIRMED: "payment_confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
  REFUNDED: "refunded",
  CLOSED: "closed",
} as const;

export type EscrowStatus = (typeof ESCROW_STATUS)[keyof typeof ESCROW_STATUS];

export const ALLOWED_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  [ESCROW_STATUS.CREATED]: [ESCROW_STATUS.WAITING_PAYMENT],
  [ESCROW_STATUS.WAITING_PAYMENT]: [
    ESCROW_STATUS.WAITING_ADMIN,
    ESCROW_STATUS.ON_HOLD,
    ESCROW_STATUS.REFUNDED,
    ESCROW_STATUS.CLOSED,
  ],
  [ESCROW_STATUS.WAITING_ADMIN]: [
    ESCROW_STATUS.PAYMENT_CONFIRMED,
    ESCROW_STATUS.REFUNDED,
    ESCROW_STATUS.ON_HOLD,
  ],
  [ESCROW_STATUS.PAYMENT_CONFIRMED]: [
    ESCROW_STATUS.IN_PROGRESS,
    ESCROW_STATUS.ON_HOLD,
    ESCROW_STATUS.REFUNDED,
  ],
  [ESCROW_STATUS.IN_PROGRESS]: [
    ESCROW_STATUS.COMPLETED,
    ESCROW_STATUS.ON_HOLD,
    ESCROW_STATUS.REFUNDED,
  ],
  [ESCROW_STATUS.COMPLETED]: [ESCROW_STATUS.CLOSED, ESCROW_STATUS.ON_HOLD],
  [ESCROW_STATUS.ON_HOLD]: [
    ESCROW_STATUS.WAITING_ADMIN,
    ESCROW_STATUS.REFUNDED,
    ESCROW_STATUS.IN_PROGRESS,
    ESCROW_STATUS.CLOSED,
  ],
  [ESCROW_STATUS.REFUNDED]: [],
  [ESCROW_STATUS.CLOSED]: [],
};

export function canTransition(from: EscrowStatus, to: EscrowStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStatusLabel(status: EscrowStatus): string {
  const labels: Record<EscrowStatus, string> = {
    [ESCROW_STATUS.CREATED]: "Created",
    [ESCROW_STATUS.WAITING_PAYMENT]: "Waiting for Payment",
    [ESCROW_STATUS.WAITING_ADMIN]: "Waiting for Admin Confirmation",
    [ESCROW_STATUS.PAYMENT_CONFIRMED]: "Payment Confirmed",
    [ESCROW_STATUS.IN_PROGRESS]: "In Progress",
    [ESCROW_STATUS.COMPLETED]: "Completed",
    [ESCROW_STATUS.ON_HOLD]: "On Hold",
    [ESCROW_STATUS.REFUNDED]: "Refunded",
    [ESCROW_STATUS.CLOSED]: "Closed",
  };
  return labels[status] || status;
}

export function getStatusColor(status: EscrowStatus): string {
  const colors: Record<EscrowStatus, string> = {
    [ESCROW_STATUS.CREATED]: "bg-gray-100 text-gray-800",
    [ESCROW_STATUS.WAITING_PAYMENT]: "bg-yellow-100 text-yellow-800",
    [ESCROW_STATUS.WAITING_ADMIN]: "bg-blue-100 text-blue-800",
    [ESCROW_STATUS.PAYMENT_CONFIRMED]: "bg-green-100 text-green-800",
    [ESCROW_STATUS.IN_PROGRESS]: "bg-purple-100 text-purple-800",
    [ESCROW_STATUS.COMPLETED]: "bg-green-100 text-green-800",
    [ESCROW_STATUS.ON_HOLD]: "bg-orange-100 text-orange-800",
    [ESCROW_STATUS.REFUNDED]: "bg-red-100 text-red-800",
    [ESCROW_STATUS.CLOSED]: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

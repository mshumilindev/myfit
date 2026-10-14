/**
 * Reschedule requests: the Today card only DRAWS them and reports the trainer's answer through this
 * port. The calendar, the "Propose another" form, the slot move and the chat card are a later milestone
 * (Schedule / Chat): they implement the port, nothing here changes.
 */
export interface RequestAnswer {
  reqId: string;
  slotId: string;
  clientId: string;
}

export interface RescheduleRequestPort {
  /** Moves the slot and posts the chat message. Rejects: the card shows an error and stays. */
  accept(a: RequestAnswer): Promise<void>;
  decline(a: RequestAnswer): Promise<void>;
  /** The trainer withdraws a request they sent. */
  cancel(a: RequestAnswer): Promise<void>;
  /** Opens the reschedule form in counter mode (a later milestone); no result is awaited. */
  propose(a: RequestAnswer): void;
}

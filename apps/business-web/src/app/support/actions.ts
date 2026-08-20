'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  assignTicket,
  closeTicket,
  escalateTicket,
  formatApiError,
  markTicketWaiting,
  reopenTicket,
  resolveTicket,
  resumeTicket,
} from '../../lib/marketplace-api';

export async function assignTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const assignedToUserId = requireFormValue(formData, 'assignedToUserId');
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket assigned.', () =>
    assignTicket(ticketId, { assignedToUserId, ...(reason ? { reason } : {}) }),
  );
}

export async function markWaitingAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const status = requireFormValue(formData, 'status');
  if (status !== 'WAITING_FOR_CUSTOMER' && status !== 'WAITING_FOR_SELLER') {
    redirectWithTicketMessage(ticketId, 'error', 'Select a valid waiting status.');
  }
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket marked waiting.', () =>
    markTicketWaiting(ticketId, { status, ...(reason ? { reason } : {}) }),
  );
}

export async function resumeTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket resumed.', () => resumeTicket(ticketId, reason));
}

export async function escalateTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket escalated.', () => escalateTicket(ticketId, reason));
}

export async function resolveTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const resolutionNote = requireFormValue(formData, 'resolutionNote');
  await runTicketAction(ticketId, 'Ticket resolved.', () =>
    resolveTicket(ticketId, resolutionNote),
  );
}

export async function closeTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket closed.', () => closeTicket(ticketId, reason));
}

export async function reopenTicketAction(formData: FormData): Promise<void> {
  const ticketId = requireFormValue(formData, 'ticketId');
  const reason = optionalFormValue(formData, 'reason');
  await runTicketAction(ticketId, 'Ticket reopened.', () => reopenTicket(ticketId, reason));
}

async function runTicketAction(
  ticketId: string,
  successMessage: string,
  operation: () => Promise<unknown>,
): Promise<never> {
  try {
    await operation();
  } catch (error) {
    redirectWithTicketMessage(ticketId, 'error', formatApiError(error));
  }
  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);
  redirectWithTicketMessage(ticketId, 'notice', successMessage);
}

function requireFormValue(formData: FormData, key: string): string {
  const value = optionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function redirectWithTicketMessage(
  ticketId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  redirect(`/support/${ticketId}?${new URLSearchParams({ [type]: message }).toString()}`);
}

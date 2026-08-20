import type { AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';

/**
 * A scheduled job or queue worker changing state without a human behind it.
 *
 * `AuditLog.actorUserId` and `actorRole` are nullable, so a system-originated
 * change is recorded with both left null and the triggering job named in
 * `reason`. This is deliberately *not* a synthetic "system user" row: inventing
 * a User that can log in, hold memberships and be assigned work in order to
 * satisfy a foreign key would be a worse lie than an honest null.
 */
export interface SystemActor {
  readonly kind: 'system';
  /** Job or process responsible for the change, e.g. a maintenance job name. */
  readonly source: string;
}

export type AuditActor = CurrentUser | SystemActor;

export function systemActor(source: string): SystemActor {
  return { kind: 'system', source };
}

export function isSystemActor(actor: AuditActor): actor is SystemActor {
  return 'kind' in actor && actor.kind === 'system';
}

/**
 * Applies actor identity to an audit record. Human actors contribute their user,
 * role and organisation; system actors contribute an attribution string instead.
 */
export function withAuditActor(actor: AuditActor, input: AuditRecordInput): AuditRecordInput {
  if (isSystemActor(actor)) {
    return {
      ...input,
      reason: input.reason ? `${input.reason} (${actor.source})` : actor.source,
    };
  }

  return {
    ...input,
    actorUserId: actor.userId,
    actorRole: actor.role,
    organisationId: input.organisationId ?? actor.organisationId,
  };
}

import 'server-only';

/* The portal sends through the same zero-dependency transports the static
   site's intake function uses (api/_lib), so sender policy, environment
   variable names and failure semantics are defined once. */
export { sendEmail, emailConfigured, publicSender, internalSender } from '../../shared/api/_lib/email.mjs';
export { sendSms, smsConfigured, ownerSmsRecipients } from '../../shared/api/_lib/sms.mjs';

export type SendResult = { configured: boolean; ok: boolean; id?: string; sid?: string; error?: string };

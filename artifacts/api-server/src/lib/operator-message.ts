export type DisplayMessageRecipient = { id: string; kind: string };

/**
 * Supports the existing `all` target plus exact display kinds/ids. Prefixed
 * values keep integrations unambiguous (`kind:speaker`, `display:display-id`);
 * comma-delimited targets allow a message to address multiple recipients.
 */
export function messageTargetsDisplay(target: string | null, display: DisplayMessageRecipient) {
  if (!target) return true;
  return target.split(",").map((value) => value.trim()).some((value) => {
    const normalized = value.toLowerCase();
    return normalized === "all"
      || normalized === "*"
      || normalized === display.kind.toLowerCase()
      || value === display.id
      || normalized === `kind:${display.kind.toLowerCase()}`
      || value === `display:${display.id}`;
  });
}

export function visibleOperatorMessage(
  message: string | null,
  target: string | null,
  expiresAt: Date | null,
  display: DisplayMessageRecipient | undefined,
  now: Date,
) {
  if (!message || (expiresAt && expiresAt <= now)) return null;
  if (display && !messageTargetsDisplay(target, display)) return null;
  return message;
}
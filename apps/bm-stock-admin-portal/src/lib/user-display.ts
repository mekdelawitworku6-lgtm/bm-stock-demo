interface NameFields {
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Avoid showing duplicated names like "staff5 staff5" when lastName was copied from firstName. */
export function formatUserName(user: NameFields): string {
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (!first && !last) return user.email || 'Unknown';
  if (!last || last.toLowerCase() === first.toLowerCase()) return first;
  return `${first} ${last}`;
}

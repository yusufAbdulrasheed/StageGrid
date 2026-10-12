export function csvCell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function attendeesCsv(rows: { name: string; email: string; code: string; checkedInAt: string | null; createdAt: string }[]) {
  const lines = rows.map((a) => [a.name, a.email, a.code, a.checkedInAt ? "yes" : "no", a.createdAt].map(csvCell).join(","));
  return ["Name,Email,Ticket code,Checked in,Registered at", ...lines].join("\n") + "\n";
}

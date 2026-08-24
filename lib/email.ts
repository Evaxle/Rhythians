function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
  return value.replace(/[&<>'"]/g, (character) => entities[character] ?? character);
}

export async function sendSecurityCode(to: string, code: string, subject: string, title: string, expiresMinutes = 15) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Rhythians <onboarding@resend.dev>";
  if (!apiKey) throw new Error("Email delivery is not configured.");

  const safeCode = escapeHtml(code);
  const safeTitle = escapeHtml(title);
  const safeMinutes = Math.max(1, Math.floor(expiresMinutes));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>${safeTitle}</h1><p>Your Rhythians security code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${safeCode}</p><p>This code expires in ${safeMinutes} minutes and can only be used once.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`,
    }),
  });

  if (!response.ok) throw new Error("Email delivery failed.");
}

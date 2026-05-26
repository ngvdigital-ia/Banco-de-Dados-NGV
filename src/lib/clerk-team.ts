// Wrappers tipados da Clerk Backend API para gerenciar membros da equipe.
// Usa fetch direto pra evitar lock-in com versão específica do SDK.

const CLERK_API = "https://api.clerk.com/v1";

function authHeader(): { Authorization: string } {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY missing");
  return { Authorization: `Bearer ${key}` };
}

export type TeamMember = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  banned: boolean;
  lastSignInAt: number | null;
  createdAt: number;
};

export type TeamInvitation = {
  id: string;
  emailAddress: string;
  status: string;
  createdAt: number;
};

type ClerkUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  banned: boolean;
  last_sign_in_at: number | null;
  created_at: number;
  email_addresses: { email_address: string }[];
  primary_email_address_id: string | null;
};

function toMember(u: ClerkUser): TeamMember {
  const primary = u.email_addresses.find(
    (e) => (e as unknown as { id: string }).id === u.primary_email_address_id,
  );
  const email = primary?.email_address ?? u.email_addresses[0]?.email_address ?? null;
  return {
    id: u.id,
    email,
    firstName: u.first_name,
    lastName: u.last_name,
    imageUrl: u.image_url,
    banned: u.banned,
    lastSignInAt: u.last_sign_in_at,
    createdAt: u.created_at,
  };
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch(`${CLERK_API}/users?limit=100&order_by=-last_sign_in_at`, {
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Clerk list users failed: ${res.status} ${await res.text()}`);
  const users = (await res.json()) as ClerkUser[];
  return users.map(toMember);
}

export async function banUser(userId: string): Promise<void> {
  const res = await fetch(`${CLERK_API}/users/${userId}/ban`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Clerk ban failed: ${res.status} ${await res.text()}`);
}

export async function unbanUser(userId: string): Promise<void> {
  const res = await fetch(`${CLERK_API}/users/${userId}/unban`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Clerk unban failed: ${res.status} ${await res.text()}`);
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${CLERK_API}/users/${userId}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Clerk delete failed: ${res.status} ${await res.text()}`);
}

export async function inviteUser(
  email: string,
  redirectUrl?: string,
): Promise<TeamInvitation> {
  const body: Record<string, unknown> = { email_address: email };
  if (redirectUrl) body.redirect_url = redirectUrl;

  const res = await fetch(`${CLERK_API}/invitations`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk invite failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    id: string;
    email_address: string;
    status: string;
    created_at: number;
  };
  return {
    id: data.id,
    emailAddress: data.email_address,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function listInvitations(): Promise<TeamInvitation[]> {
  const res = await fetch(`${CLERK_API}/invitations?status=pending&limit=50`, {
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Clerk list invitations failed: ${res.status} ${await res.text()}`);
  const arr = (await res.json()) as {
    id: string;
    email_address: string;
    status: string;
    created_at: number;
  }[];
  return arr.map((i) => ({
    id: i.id,
    emailAddress: i.email_address,
    status: i.status,
    createdAt: i.created_at,
  }));
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const res = await fetch(`${CLERK_API}/invitations/${invitationId}/revoke`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Clerk revoke invitation failed: ${res.status} ${await res.text()}`);
}

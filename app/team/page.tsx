"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2, MailPlus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { appStorageKeys, readJson, writeJson } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Invitation, Organization, OrganizationMember, TeamRole } from "@/lib/types";

const roles: TeamRole[] = ["Owner", "Admin", "QA Lead", "Tester", "Reviewer", "Viewer"];
const defaultOrganization: Organization = {
  id: "local-organization",
  name: "PlanetKosa QA Workspace",
  createdAt: new Date().toISOString()
};
const defaultMembers: OrganizationMember[] = [
  {
    id: "local-owner",
    organizationId: "local-organization",
    name: "Othaim Kosa",
    email: "planetkosa@gmail.com",
    role: "Owner",
    status: "Active",
    createdAt: new Date().toISOString()
  }
];

export default function TeamPage() {
  const [organization, setOrganization] = useState<Organization>(defaultOrganization);
  const [members, setMembers] = useState<OrganizationMember[]>(defaultMembers);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("Reviewer");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setOrganization(readJson(appStorageKeys.organization, defaultOrganization));
    setMembers(readJson(appStorageKeys.organizationMembers, defaultMembers));
    setInvitations(readJson(appStorageKeys.invitations, []));
  }, []);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Enter an email address before creating an invitation.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const invitation: Invitation = {
        id: crypto.randomUUID(),
        organizationId: organization.id,
        email: normalizedEmail,
        role,
        status: "Pending",
        createdAt: new Date().toISOString()
      };

      const supabase = createSupabaseBrowserClient();
      if (supabase && !organization.id.startsWith("local-")) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          throw new Error("Sign in before inviting team members.");
        }
        const result = await supabase.from("invitations").insert({
          organization_id: organization.id,
          email: invitation.email,
          role: invitation.role,
          status: "Pending",
          invited_by: user.data.user.id
        });
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      const nextInvitations = [invitation, ...invitations];
      setInvitations(nextInvitations);
      writeJson(appStorageKeys.invitations, nextInvitations);
      setEmail("");
      setMessage("Invitation created as Pending. Email delivery is coming soon.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation could not be created.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Team"
        description="Manage organization membership foundations, roles, and pending invitations for collaborative QA workflows."
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={inviteMember} className="card p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-brand-blue">
              <MailPlus className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Invite Teammate</h2>
              <p className="text-sm text-slate-600">Create a pending invitation record for the workspace.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="qa.reviewer@example.com" />
            </label>
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">Role</span>
              <select className="focus-ring min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as TeamRole)}>
                {roles.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <Button className="mt-5" disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MailPlus className="size-4" aria-hidden />}>
            {loading ? "Creating Invitation" : "Invite"}
          </Button>
          {message ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        </form>

        <div className="space-y-5">
          <article className="card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-brand-teal">
                  <UsersRound className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{organization.name}</h2>
                  <p className="text-sm text-slate-600">Organization workspace</p>
                </div>
              </div>
              <Badge tone="teal">{members.length} active</Badge>
            </div>
          </article>

          <TableCard title="Members">
            {members.map((member) => (
              <tr key={member.id} className="table-row">
                <td className="px-4 py-3 font-semibold text-slate-900">{member.name}</td>
                <td className="px-4 py-3 text-slate-600">{member.email}</td>
                <td className="px-4 py-3"><Badge tone={member.role === "Owner" ? "blue" : "neutral"}>{member.role}</Badge></td>
                <td className="px-4 py-3"><Badge tone="teal">{member.status}</Badge></td>
              </tr>
            ))}
          </TableCard>

          <TableCard title="Pending Invitations">
            {invitations.length ? invitations.map((invitation) => (
              <tr key={invitation.id} className="table-row">
                <td className="px-4 py-3 font-semibold text-slate-900">{invitation.email}</td>
                <td className="px-4 py-3 text-slate-600">{invitation.role}</td>
                <td className="px-4 py-3"><Badge>{invitation.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{new Date(invitation.createdAt).toLocaleString()}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No pending invitations.</td></tr>
            )}
          </TableCard>
        </div>
      </section>
    </AppShell>
  );
}

function TableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Name / Email</th>
              <th className="px-4 py-3">Email / Role</th>
              <th className="px-4 py-3">Role / Status</th>
              <th className="px-4 py-3">Status / Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </article>
  );
}

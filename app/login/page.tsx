"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = hasSupabaseConfig();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage("Add Supabase environment variables to enable authentication.");
      return;
    }

    setLoading(true);
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name
              }
            }
          });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Account created. Check email confirmation settings in Supabase if sign-in is not immediate.");
    }

    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1fr_1.1fr]">
      <section className="hidden bg-brand-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-white text-brand-blue">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-bold">QAplanet</span>
            <span className="text-xs text-blue-100">qaplanet.ca</span>
          </span>
        </Link>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">Enterprise QA workspace</p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight">Turn requirements into test cases and automation.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100">
            Securely connect Supabase Auth, keep project artifacts in Postgres and Storage, and generate structured QA outputs with OpenAI.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <ArrowLeft className="size-4" aria-hidden />
            Back to QAplanet
          </Link>
          <div className="card p-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{mode === "login" ? "Login" : "Create account"}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use Supabase Auth to access your QAplanet workspace.
              </p>
            </div>

            {!configured ? (
              <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Supabase is not configured yet. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Analyst" />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Password</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </label>

              {message ? <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}

              <Button className="w-full" disabled={loading} icon={loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
                {mode === "login" ? "Sign in" : "Sign up"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-5 w-full rounded-md px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Gergely Verhoczki" },
      { name: "description", content: "Private sign-in for the portfolio owner." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — Gergely Verhoczki" },
      { property: "og:description", content: "Private sign-in for the portfolio owner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin", replace: true });
    });
    supabase.rpc("owner_exists").then(({ data }) => setNeedsSetup(data === false));
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (needsSetup) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (signUpError) {
        setLoading(false);
        setError(signUpError.message);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setLoading(false);
        setError("Account created — please sign in.");
        setNeedsSetup(false);
        return;
      }
      await supabase.rpc("claim_owner");
      setLoading(false);
      navigate({ to: "/admin", replace: true });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Those credentials didn't work.");
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-leica-red" aria-hidden="true" />
          <span className="font-heading text-lg font-medium tracking-tight">Gergely Verhoczki</span>
        </div>

        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {needsSetup ? "Create your owner account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {needsSetup
            ? "This is a one-time setup. Once created, no other account can be registered."
            : "Private access for the portfolio owner."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border-b border-border bg-transparent py-2 text-base outline-none transition-colors focus:border-foreground"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={needsSetup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full border-b border-border bg-transparent py-2 text-base outline-none transition-colors focus:border-foreground"
            />
          </div>

          {error && <p className="text-sm text-leica-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-sm bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait…" : needsSetup ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}


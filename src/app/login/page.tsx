"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("outsideHours")) {
      setError("You've been signed out — it's outside your assigned access hours.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        if (res.code === "OutsideAccessHours") {
          setError("You can only sign in during your assigned access hours.");
        } else {
          setError("Invalid email or password.");
        }
      } else {
        const callbackUrl = searchParams.get("callbackUrl") || "/";
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 8% 8%, rgba(212,166,45,0.08), transparent 42%), radial-gradient(circle at 95% 15%, rgba(18,33,66,0.06), transparent 40%), linear-gradient(180deg, #F8F7F5, #F1E9D8)",
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          borderRadius: 22,
          padding: 32,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 24px 60px rgba(15,31,61,0.16)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#122142",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 33V21.5L26 14L37 21.5V33" stroke="#D4A62D" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.5 33V25.5H31.5V33" stroke="#D4A62D" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", fontFamily: "'Libre Caslon Text', Georgia, serif" }}>
          Chijwani RealTech OS
        </h1>
        <p style={{ fontSize: 13, color: "#5A5347", margin: "0 0 24px" }}>
          Sign in to your CRM
        </p>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "#5A5347",
              marginBottom: 5,
            }}
          >
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 13px",
              border: "1px solid rgba(18,33,66,0.08)",
              borderRadius: 12,
              fontSize: "13.5px",
              background: "#F8F7F5",
            }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "#5A5347",
              marginBottom: 5,
            }}
          >
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 13px",
              border: "1px solid rgba(18,33,66,0.08)",
              borderRadius: 12,
              fontSize: "13.5px",
              background: "#F8F7F5",
            }}
          />
        </div>
        {error && (
          <div style={{ color: "#AC3D3D", fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "#122142",
            color: "#fff",
            border: "none",
            padding: "12px 20px",
            borderRadius: 14,
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

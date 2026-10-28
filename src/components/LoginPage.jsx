import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { auth } from "../firebase";
import coachingLogo from "../assets/coaching-logo.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your work email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
    } catch (err) {
      const code = err?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("Invalid email or password. Please verify your credentials.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many unsuccessful attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError("Incorrect email or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#F8F9FC] text-[#111827]">
      {/* ====================================================================
          LEFT SIDE: Branding Panel (Desktop >= 1024px)
          ==================================================================== */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#2E1065] to-[#483BFF] p-10 xl:p-14 text-white">
        {/* Background decorative subtle geometry */}
        <div className="pointer-events-none absolute inset-0 opacity-15">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#483BFF] blur-3xl" />
          <div className="absolute top-1/2 -right-24 h-96 w-96 rounded-full bg-[#6366F1] blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-[#3729E6] blur-2xl" />
        </div>

        {/* Top Logo & Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <img
              src={coachingLogo}
              alt="Coaching Ops"
              className="h-11 w-11 object-contain rounded-xl bg-white/10 p-1 backdrop-blur-xs ring-1 ring-white/20"
            />
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Coaching Ops
              </span>
              <span className="block text-[11px] font-medium tracking-wider uppercase text-indigo-200">
                NTI · Creative i-Lance
              </span>
            </div>
          </div>
        </div>

        {/* Center Editorial / Value Proposition */}
        <div className="relative z-10 max-w-lg my-auto py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-indigo-200 backdrop-blur-xs ring-1 ring-white/15">
            <Sparkles size={13} className="text-[#818CF8]" />
            <span>Coaching Operations Workspace</span>
          </div>

          <h1 className="mt-5 text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Manage Smarter.
            <br />
            Operate Better.
          </h1>

          <p className="mt-4 text-sm xl:text-base text-indigo-100/90 leading-relaxed">
            One workspace to manage coaching groups, track weekly sessions,
            coordinate roster assignments, and keep your operations synchronized.
          </p>

          {/* Operational feature highlights */}
          <div className="mt-8 grid grid-cols-2 gap-3.5 pt-6 border-t border-white/10">
            <div className="rounded-xl bg-white/5 p-3.5 backdrop-blur-xs ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-indigo-200 mb-1">
                <UsersRound size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Rosters
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                Real-time student & group tracking
              </p>
            </div>

            <div className="rounded-xl bg-white/5 p-3.5 backdrop-blur-xs ring-1 ring-white/10">
              <div className="flex items-center gap-2 text-indigo-200 mb-1">
                <CalendarDays size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Sessions
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                10-week schedule & attendance
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-indigo-200/80 pt-6 border-t border-white/10">
          <span>Enterprise Coaching Management</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Role-Based Access Control</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          RIGHT SIDE: Login Form Panel (Mobile & Desktop)
          ==================================================================== */}
      <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Top Header (compact branding on < 1024px) */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img
              src={coachingLogo}
              alt="Coaching Ops"
              className="h-10 w-10 object-contain rounded-xl bg-indigo-50 p-1 ring-1 ring-indigo-200"
            />
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                Coaching Ops
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#483BFF]">
                Operations Portal
              </span>
            </div>
          </div>

          {/* Form Card */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
            <div className="mb-6">
              <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#483BFF] mb-2.5">
                <Sparkles size={11} />
                <span>Secure Workspace</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Welcome Back
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Sign in to continue to your Coaching Ops workspace.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
              >
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-rose-600 flex-none" />
                <span className="flex-1 font-medium leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Work Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Work Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coordinator@coaching-ops.com"
                    className="block w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#483BFF] focus:ring-2 focus:ring-[#483BFF]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#483BFF] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#483BFF]/25 hover:bg-[#3729E6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <span className="text-[11px] text-slate-400">
                Restricted operational system. Authorized personnel only.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { login } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--navy)]">
      <form action={login} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-[var(--navy)]">Voiant marketing dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Enter the team password to continue.</p>
        <label htmlFor="password" className="mt-6 block text-sm font-medium text-slate-700">Password</label>
        <input id="password" name="password" type="password" required autoFocus autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/30" />
        {error && <p role="alert" className="mt-2 text-sm text-red-700">That password isn't right. Try again.</p>}
        <button type="submit" className="mt-5 w-full rounded-lg bg-[var(--navy)] px-4 py-2 font-medium text-white hover:bg-[var(--blue)]">Open dashboard</button>
      </form>
    </main>
  );
}

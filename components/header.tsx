import { logout } from "../app/login/actions";

const TABS = [{ href: "/", label: "Overview" }, { href: "/organic", label: "Organic" }, { href: "/ads", label: "Ads" }, { href: "/outreach", label: "Outreach" }, { href: "/accounts", label: "Accounts" }, { href: "/mqls", label: "MQLs" }];

export function Header({ subtitle, active }: { subtitle: string; active: string }) {
  return (
    <header className="bg-[var(--navy)] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div>
          <h1 className="text-lg font-semibold">Voiant marketing dashboard</h1>
          <p className="text-sm text-white/75">{subtitle}</p>
        </div>
        <form action={logout}><button className="rounded-lg border border-white/40 px-3 py-1.5 text-sm hover:bg-white/10">Sign out</button></form>
      </div>
      <nav className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Pages">
        {TABS.map(t => (
          <a key={t.href} href={t.href} aria-current={t.href === active ? "page" : undefined}
            className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium ${t.href === active ? "bg-[var(--bg)] text-[var(--navy)]" : "text-white/80 hover:bg-white/10"}`}>{t.label}</a>
        ))}
      </nav>
    </header>
  );
}

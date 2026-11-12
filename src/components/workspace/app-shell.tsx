"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "../ui/brand";
import { Icon, type IconName } from "../ui/icon";
import { Dialog } from "../ui/dialog";
import { useWorkspace } from "./workspace-provider";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Suggested jobs", icon: "home" },
  { href: "/proposals", label: "Proposal desk", icon: "desk" },
  { href: "/projects", label: "Projects", icon: "layers" },
  { href: "/about", label: "About us", icon: "book" },
  { href: "/activity", label: "Activity", icon: "chart" },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    { profile, logout, status } = useWorkspace();
  const [modal, setModal] = useState<"help" | "profile" | null>(null);
  const name =
    pathname === "/settings"
      ? "Settings"
      : (navigation.find((item) => item.href === pathname)?.label ??
        "Workspace");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand href="/dashboard" />
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
              {pathname === item.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
            href="/settings"
          >
            <Icon name="settings" />
            Settings
          </Link>
          <button className="nav-item" onClick={() => void logout()}>
            <Icon name="logout" />
            Sign out
          </button>
          <div className="local-status">
            <span />
            NordStone workspace
            <Icon name="shield" />
          </div>
          <button className="profile" onClick={() => setModal("profile")}>
            <span className="avatar">{profile.memberName.slice(0, 1)}</span>
            <span>
              <strong>{profile.memberName}</strong>
              <small>{profile.companyName} · Operator</small>
            </span>
            <Icon name="chevrons" />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace<span>/</span>
            <strong>{name}</strong>
          </div>
          <div className="topbar-right">
            <span className="prototype-tag">
              {status.upworkConnected ? "UPWORK CONNECTED" : "WORKSPACE"}
            </span>
            <span className="offline-pill">
              <span />
              Workspace active
            </span>
            <button
              className="icon-button"
              aria-label="About this workspace"
              onClick={() => setModal("help")}
            >
              <Icon name="help" />
            </button>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <span>
            <Icon name="lock" />
            Review here. Submit manually on Upwork.
          </span>
          <span>
            NordStone desk<b>v1.0</b>
          </span>
        </footer>
      </div>
      {modal && (
        <Dialog
          title={
            modal === "help"
              ? "Your proposal workspace"
              : `${profile.memberName} · ${profile.companyName}`
          }
          onClose={() => setModal(null)}
        >
          {modal === "help" ? (
            <>
              <p>
                Save About us once, add the job title and brief, then generate
                and review your proposal.
              </p>
              <p>
                AI generation sends the selected task and saved company profile
                to your configured AI provider. Active work is saved in this browser.
              </p>
            </>
          ) : (
            <p>
              {status.upworkConnected
                ? "Upwork is connected for job import."
                : "Upwork is not connected. You can enter jobs manually."}{" "}
              Signing out clears the active job and draft.
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}

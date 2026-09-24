"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Estimating",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/estimates/new", label: "New Estimate" },
      { href: "/estimates", label: "Estimates" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/historical-shows", label: "Historical Shows" },
      { href: "/pricing", label: "Pricing" },
      { href: "/rules", label: "Rules" },
      { href: "/insights", label: "Insights" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin", label: "Admin" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3 py-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{section.label}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active ? "bg-sidebar-active text-sidebar-fg font-medium" : "text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

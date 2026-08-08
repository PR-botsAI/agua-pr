import Link from "next/link";

const items = [
  { href: "/", icon: "⌂", label: "Inicio" },
  { href: "/agua/", icon: "💧", label: "Agua" },
  { href: "/clima/", icon: "☁️", label: "Clima" },
  { href: "/ayuda/", icon: "☎", label: "Ayuda" },
];

export function Nav() {
  return (
    <nav className="nav" aria-label="Navegación principal">
      <div className="nav-inner">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

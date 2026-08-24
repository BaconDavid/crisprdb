import styles from "@/css/Navigation.module.css";
import messages from "@/data/en.json";
import { BarChart3, Home, Mail, Search } from "lucide-react";

type NavIconName = "home" | "analysis" | "search" | "contact";

const siteBrand = {
  name: "CRISPR_Database",
  href: "/",
};

const siteNav = [
  {
    label: messages.navigation.home,
    href: "/",
    icon: "home",
  },
  {
    label: messages.navigation.analysis,
    href: "#",
    icon: "analysis",
    children: [
      { label: "Blastp", href: "/Analysis/blastp" },
      { label: "Embedding Search", href: "#" },
      { label: "Structure Module", href: "#" },
    ],
  },
  {
    label: messages.navigation.search,
    href: "/Browse",
    icon: "search",
  },
  {
    label: messages.navigation.contact,
    href: "#",
    icon: "contact",
  },
] satisfies Array<{
  label: string;
  href: string;
  icon: NavIconName;
  children?: Array<{ label: string; href: string }>;
}>;

function NavIcon({ name }: { name: NavIconName }) {
  const icons = {
    home: Home,
    analysis: BarChart3,
    search: Search,
    contact: Mail,
  };
  const Icon = icons[name];

  return <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.8} />;
}

export function Navigation() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <a href={siteBrand.href} className={styles.logo}>
          {siteBrand.name}
        </a>

        <div className={styles.links}>
          {siteNav.map((item) =>
            item.children ? (
              <div key={item.label} className={styles.navItem}>
                <button type="button" className={styles.navLink}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </button>

                <div className={styles.dropdown}>
                  {item.children.map((child) => (
                    <a key={child.label} href={child.href} className={styles.dropdownLink}>
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={item.label} href={item.href} className={styles.navLink}>
                <NavIcon name={item.icon} />
                {item.label}
              </a>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}

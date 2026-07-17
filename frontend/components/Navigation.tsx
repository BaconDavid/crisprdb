import { siteBrand, siteNav } from "@/data/site";
import styles from "@/css/Navigation.module.css";
import { BarChart3, Home, Mail, Search } from "lucide-react";

type NavIconName = "home" | "analysis" | "search" | "contact";

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
                  <NavIcon name={item.icon as NavIconName} />
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
                <NavIcon name={item.icon as NavIconName} />
                {item.label}
              </a>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}

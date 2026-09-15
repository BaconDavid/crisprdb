"use client";

import styles from "@/css/Navigation.module.css";
import { BarChart3, Home, Mail, Search } from "lucide-react";

import { useI18n } from "@/components/I18nProvider";

type NavIconName = "home" | "analysis" | "search" | "contact";

const siteBrand = {
  name: "CRISPR Database",
  href: "/",
};

type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
  children?: Array<{ label: string; href: string }>;
};

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
  const { locale, messages, toggleLocale } = useI18n();
  const nav = messages.navigation;
  const siteNav: NavItem[] = [
    { label: nav.home, href: "/", icon: "home" },
    {
      label: nav.analysis,
      href: "#",
      icon: "analysis",
      children: [
        { label: nav.blastp, href: "/Analysis/blastp" },
        { label: nav.embedding, href: "#" },
        { label: nav.structure, href: "/Analysis/structure" },
      ],
    },
    { label: nav.search, href: "/Browse", icon: "search" },
    { label: nav.contact, href: "#", icon: "contact" },
  ];

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
          <button
            type="button"
            className={styles.languageToggle}
            onClick={toggleLocale}
            aria-label={nav.switchLanguage}
            title={nav.switchLanguage}
          >
            {locale === "en" ? "中文" : "EN"}
          </button>
        </div>
      </nav>
    </header>
  );
}

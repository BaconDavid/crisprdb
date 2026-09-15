"use client";

import ReactMarkdown from "react-markdown";
import { useI18n } from "@/components/I18nProvider";
import styles from "@/css/HomeDashboard.module.css";

export function HeroSection() {
  const { messages } = useI18n();
  const { home } = messages;

  return (
    <>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.title}>{home.title}</h1>
          <div className={styles.description}>
            <ReactMarkdown
              allowedElements={["p", "strong", "em", "ul", "ol", "li", "a"]}
              components={{
                a: ({ children, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {home.description}
            </ReactMarkdown>
          </div>
        </div>
      </section>

      <section className={styles.mechanismSection}>
        <div className={styles.mechanismPlaceholder}>
          <div className={styles.mechanismInner}>
            <p className={styles.placeholderTitle}>{home.mechanismTitle}</p>
            <p className={styles.placeholderText}>{home.mechanismText}</p>
          </div>
        </div>
      </section>
    </>
  );
}

import styles from "@/css/HomeDashboard.module.css";
import messages from "@/data/en.json";

export function HeroSection() {
  const { home } = messages;

  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{home.eyebrow}</p>
          <h1 className={styles.title}>{home.title}</h1>
          <p className={styles.description}>{home.description}</p>
        </div>
      </section>

      <section className={styles.mechanismSection}>
        <div className={styles.mechanismPlaceholder}>
          <div className={styles.mechanismInner}>
            <p className={styles.placeholderTitle}>CRISPR mechanism artwork</p>
            <p className={styles.placeholderText}>
              Reserved for the future mechanism illustration.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

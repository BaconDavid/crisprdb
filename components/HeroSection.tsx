import { homeIntro } from "@/data/home";
import styles from "@/css/HomeDashboard.module.css";

export function HeroSection() {
  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{homeIntro.eyebrow}</p>
          <h1 className={styles.title}>{homeIntro.title}</h1>
          <p className={styles.description}>{homeIntro.description}</p>
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

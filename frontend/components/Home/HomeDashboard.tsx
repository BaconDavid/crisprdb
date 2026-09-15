import { CountryDistributionPanel } from "@/components/Home/CountryDistributionPanel";
import { DistributionPanel } from "@/components/Home/DistributionPanel";
import { HeroSection } from "@/components/Home/HeroSection";
import { MetricCards } from "@/components/Home/MetricCards";
import styles from "@/css/HomeDashboard.module.css";

type DistributionDatum = {
  label: string;
  value: number;
};

type SubtypeDistribution = {
  description: string;
  items: DistributionDatum[];
  title: string;
};

type CountryDistributionDatum = {
  country: string;
  count: number;
  label?: string;
};

type HomeStatisticData = {
  countries: Record<string, number>;
  subtypes: Record<string, number>;
  total_operons: number;
  total_projects: number | null;
  total_proteins: number;
};

// Server Components require an absolute URL; this address is never exposed to browsers.
const API_BASE_URL = (
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");
const CLASS_1_TYPES = new Set(["I", "III", "IV"]);
const CLASS_2_TYPES = new Set(["II", "V", "VI"]);
const TYPE_ORDER = ["I", "II", "III", "IV", "V", "VI"];

async function fetchHomeStatisticData(): Promise<HomeStatisticData> {
  const response = await fetch(`${API_BASE_URL}/api/home/home_statistic_data`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch home statistic data");
  }

  return response.json();
}

function getTypeFromSubtype(subtype: string) {
  const cleanSubtype = subtype.replace(/^Type\s+/i, "").trim();
  return cleanSubtype.split("-")[0]?.trim() ?? "Unknown";
}

function getClassLabel(typeName: string) {
  if (CLASS_1_TYPES.has(typeName)) return "Class 1";
  if (CLASS_2_TYPES.has(typeName)) return "Class 2";
  return "Unknown";
}

function compareTypeLabels(a: string, b: string) {
  const indexA = TYPE_ORDER.indexOf(a);
  const indexB = TYPE_ORDER.indexOf(b);

  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b);
}

function buildDistributionData(subtypes: Record<string, number>) {
  const classCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const subtypeCountsByType = new Map<string, DistributionDatum[]>();

  for (const [subtype, count] of Object.entries(subtypes)) {
    const typeName = getTypeFromSubtype(subtype);
    const classLabel = getClassLabel(typeName);

    classCounts.set(classLabel, (classCounts.get(classLabel) ?? 0) + count);
    typeCounts.set(typeName, (typeCounts.get(typeName) ?? 0) + count);

    const subtypeItems = subtypeCountsByType.get(typeName) ?? [];
    subtypeItems.push({ label: `Type ${subtype.replace(/^Type\s+/i, "")}`, value: count });
    subtypeCountsByType.set(typeName, subtypeItems);
  }

  const classDistribution = ["Class 1", "Class 2", "Unknown"]
    .map((label) => ({ label, value: classCounts.get(label) ?? 0 }))
    .filter((item) => item.value > 0);

  const typeDistribution = Array.from(typeCounts.entries())
    .sort(([typeA], [typeB]) => compareTypeLabels(typeA, typeB))
    .map(([typeName, value]) => ({ label: `Type ${typeName}`, value }));

  const subtypeDistribution: SubtypeDistribution[] = Array.from(subtypeCountsByType.entries())
    .sort(([typeA], [typeB]) => compareTypeLabels(typeA, typeB))
    .map(([typeName, items]) => ({
      description: `${getClassLabel(typeName)} subtype split`,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
      title: `Type ${typeName}`,
    }));

  return {
    classDistribution,
    subtypeDistribution,
    typeDistribution,
  };
}

function getMapCountryName(country: string) {
  if (country === "United States") return "United States of America";
  if (country === "USA") return "United States of America";
  return country;
}

function buildCountryDistribution(countries: Record<string, number>): CountryDistributionDatum[] {
  return Object.entries(countries).map(([country, count]) => {
    const mapCountry = getMapCountryName(country);

    return {
      country: mapCountry,
      count,
      label: mapCountry === country ? undefined : country,
    };
  });
}

export async function HomeDashboard() {
  const homeStatisticData = await fetchHomeStatisticData();
  const distributionData = buildDistributionData(homeStatisticData.subtypes);
  const countryDistribution = buildCountryDistribution(homeStatisticData.countries);

  return (
    <main className={styles.main}>
      <HeroSection />
      <MetricCards
        totalCountries={Object.keys(homeStatisticData.countries).length}
        totalOperons={homeStatisticData.total_operons}
        totalProjects={homeStatisticData.total_projects}
        totalProteins={homeStatisticData.total_proteins}
      />

      <section className={styles.contentGrid}>
        <DistributionPanel
          classDistribution={distributionData.classDistribution}
          subtypeDistribution={distributionData.subtypeDistribution}
          typeDistribution={distributionData.typeDistribution}
        />
        <CountryDistributionPanel countryDistribution={countryDistribution} />
      </section>
    </main>
  );
}

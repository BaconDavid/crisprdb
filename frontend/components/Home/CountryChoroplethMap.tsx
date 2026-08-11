"use client";

import { useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countries from "world-atlas/countries-50m.json";

import styles from "@/css/CountryChoroplethMap.module.css";

type CountryDistributionDatum = {
  country: string;
  count: number;
  label?: string;
};

type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;
type CountryFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 380;
const MAP_SCALE_X = 1.24;
const MAP_SCALE_Y = 1.04;

function getColor(count: number) {
  if (count >= 16) return "#166534";
  if (count >= 10) return "#16a34a";
  if (count >= 6) return "#5eead4";
  if (count >= 3) return "#a5f3fc";
  if (count > 0) return "#dbeafe";
  return "#d6dee8";
}

export function CountryChoroplethMap({
  countryDistribution,
}: {
  countryDistribution: CountryDistributionDatum[];
}) {
  const [activeCountry, setActiveCountry] = useState("Hover over a country");

  const sampleByCountry = useMemo(() => {
    return new Map(countryDistribution.map((item) => [item.country, item]));
  }, [countryDistribution]);

  const { pathGenerator, worldFeatures } = useMemo(() => {
    const world = feature(
      countries as unknown as Parameters<typeof feature>[0],
      (countries as { objects: { countries: unknown } }).objects
        .countries as Parameters<typeof feature>[1],
    ) as unknown as CountryFeatureCollection;

    const projection = geoEqualEarth().fitExtent(
      [
        [0, 8],
        [MAP_WIDTH, MAP_HEIGHT - 8],
      ],
      world,
    );

    return {
      pathGenerator: geoPath(projection),
      worldFeatures: world.features,
    };
  }, []);

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapInfo}>{activeCountry}</div>
      <svg
        aria-label="Country-level sample distribution"
        className={styles.map}
        role="img"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      >
        <rect className={styles.ocean} height={MAP_HEIGHT} width={MAP_WIDTH} x="0" y="0" />
        <g
          transform={`translate(${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}) scale(${MAP_SCALE_X} ${MAP_SCALE_Y}) translate(${-MAP_WIDTH / 2} ${-MAP_HEIGHT / 2})`}
        >
          {worldFeatures.map((country) => {
            const name = (country as CountryFeature).properties.name;
            const sample = sampleByCountry.get(name);
            const displayName = sample?.label ?? name;
            const count = sample?.count ?? 0;
            const path = pathGenerator(country);

            if (!path) return null;

            return (
              <path
                className={styles.country}
                d={path}
                fill={getColor(count)}
                key={name}
                onBlur={() => setActiveCountry("Hover over a country")}
                onFocus={() => setActiveCountry(`${displayName}: ${count} samples`)}
                onMouseLeave={() => setActiveCountry("Hover over a country")}
                onMouseMove={() => setActiveCountry(`${displayName}: ${count} samples`)}
                tabIndex={0}
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${displayName}: ${count} samples`}</title>
              </path>
            );
          })}
        </g>
      </svg>
      <div className={styles.legend} aria-label="Sample count legend">
        <span><i style={{ background: "#d6dee8" }} />0</span>
        <span><i style={{ background: "#dbeafe" }} />1-2</span>
        <span><i style={{ background: "#a5f3fc" }} />3-5</span>
        <span><i style={{ background: "#5eead4" }} />6-9</span>
        <span><i style={{ background: "#16a34a" }} />10-15</span>
        <span><i style={{ background: "#166534" }} />16+</span>
      </div>
    </div>
  );
}

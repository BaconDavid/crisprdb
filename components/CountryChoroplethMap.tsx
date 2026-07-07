"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLngBounds, Map as LeafletMap, Path } from "leaflet";
import { feature } from "topojson-client";
import countries from "world-atlas/countries-110m.json";

import { countrySampleCounts } from "@/data/home";
import styles from "@/css/CountryChoroplethMap.module.css";

type CountryFeature = GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;

function getColor(count: number) {
  if (count >= 16) return "#0f766e";
  if (count >= 10) return "#14b8a6";
  if (count >= 6) return "#67e8f9";
  if (count >= 3) return "#bae6fd";
  if (count > 0) return "#e0f2fe";
  return "#f8fafc";
}

export function CountryChoroplethMap() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [activeCountry, setActiveCountry] = useState("Hover over a country");

  const sampleByCountry = useMemo(() => {
    return new Map(countrySampleCounts.map((item) => [item.country, item]));
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    let isMounted = true;

    async function createMap() {
      const L = await import("leaflet");

      if (!isMounted || !mapElementRef.current || mapRef.current) return;

      const map = L.map(mapElementRef.current, {
        attributionControl: false,
        maxBounds: [
          [-90, -190],
          [90, 190],
        ],
        minZoom: 1,
        scrollWheelZoom: false,
        worldCopyJump: true,
        zoomControl: true,
      }).setView([20, 0], 2);

      const countriesGeoJson = feature(
        countries as unknown as Parameters<typeof feature>[0],
        (countries as { objects: { countries: unknown } }).objects
          .countries as Parameters<typeof feature>[1],
      ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;

      const layer = L.geoJSON(countriesGeoJson, {
        style: (countryFeature) => {
          const name = (countryFeature as CountryFeature).properties.name;
          const count = sampleByCountry.get(name)?.count ?? 0;

          return {
            color: "#ffffff",
            fillColor: getColor(count),
            fillOpacity: count > 0 ? 0.82 : 0.45,
            opacity: 1,
            weight: 0.8,
          };
        },
        onEachFeature: (countryFeature, countryLayer) => {
          const name = (countryFeature as CountryFeature).properties.name;
          const sample = sampleByCountry.get(name);
          const displayName = sample?.label ?? name;
          const count = sample?.count ?? 0;

          countryLayer.bindTooltip(`${displayName}: ${count} samples`);

          countryLayer.on({
            click: (event) => {
              const target = event.target as Path & { getBounds: () => LatLngBounds };
              map.fitBounds(target.getBounds(), { padding: [24, 24] });
            },
            mouseout: () => {
              layer.resetStyle(countryLayer);
              setActiveCountry("Hover over a country");
            },
            mouseover: (event) => {
              const target = event.target as Path;
              target.setStyle({
                color: "#0f172a",
                fillOpacity: 0.95,
                weight: 2,
              });
              target.bringToFront();
              setActiveCountry(`${displayName}: ${count} samples`);
            },
          });
        },
      }).addTo(map);

      map.fitBounds(layer.getBounds(), { padding: [10, 10] });
      mapRef.current = map;
    }

    createMap();

    return () => {
      isMounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [sampleByCountry]);

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapInfo}>{activeCountry}</div>
      <div ref={mapElementRef} className={styles.map} />
      <div className={styles.legend} aria-label="Sample count legend">
        <span><i style={{ background: "#e0f2fe" }} />1-2</span>
        <span><i style={{ background: "#bae6fd" }} />3-5</span>
        <span><i style={{ background: "#67e8f9" }} />6-9</span>
        <span><i style={{ background: "#14b8a6" }} />10-15</span>
        <span><i style={{ background: "#0f766e" }} />16+</span>
      </div>
    </div>
  );
}

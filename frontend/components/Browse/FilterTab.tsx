"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { BrowseFilters } from "./api";
import { useI18n } from "@/components/I18nProvider";
import styles from "@/css/Browse.module.css";

export interface FilterGroup {
  field: string;
  label: string;
}

export interface FilterSection {
  id: string;
  title: string;
  groups: FilterGroup[];
}

export interface FilterRange {
  bounds: [number, number];
  value: [number, number];
  title: string;
  unit?: string;
  hint: string;
}

interface FilterTabProps {
  ariaLabel?: string;
  sections: FilterSection[];
  facets: Record<string, Record<string, number>>;
  selected: BrowseFilters;
  range: FilterRange | null;
  loading?: boolean;
  onToggle: (field: string, value: string) => void;
  onRangeChange: (range: [number, number]) => void;
  onReset: () => void;
}

export function FilterTab({
  ariaLabel = "Browse filters",
  sections,
  facets,
  selected,
  range,
  loading = false,
  onToggle,
  onRangeChange,
  onReset,
}: FilterTabProps) {
  const { messages } = useI18n();
  const filterMessages = messages.browse.filters;
  const sectionTitles = filterMessages.sections as Record<string, string>;
  const fieldLabels = filterMessages.fields as Record<string, string>;
  const [openSections, setOpenSections] = useState<string[]>([sections[0]?.id]);

  function toggleSection(sectionId: string) {
    setOpenSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  const activeCount = Object.values(selected).reduce(
    (total, values) => total + values.length,
    0,
  );

  return (
    <aside className={styles.filterColumn} aria-label={ariaLabel}>
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div>
            <span className={styles.filterTitle}>{filterMessages.title}</span>
            {activeCount > 0 && (
              <span className={styles.activeFilterCount}>{activeCount}</span>
            )}
          </div>
          <button type="button" className={styles.resetButton} onClick={onReset}>
            {filterMessages.reset}
          </button>
        </div>

        <div className={styles.filterScroll} aria-busy={loading}>
          {sections.map((section) => {
            const isOpen = openSections.includes(section.id);
            const sectionCount = section.groups.reduce(
              (total, group) => total + (selected[group.field]?.length ?? 0),
              0,
            );

            return (
              <section key={section.id} className={styles.filterSection}>
                <button
                  type="button"
                  className={styles.sectionButton}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className={styles.sectionButtonLabel}>
                    <ChevronRight
                      aria-hidden="true"
                      className={isOpen ? styles.chevronOpen : styles.chevron}
                      size={15}
                    />
                    {sectionTitles[section.id] ?? section.title}
                  </span>
                  {sectionCount > 0 && (
                    <span className={styles.sectionCount}>{sectionCount}</span>
                  )}
                </button>

                {isOpen && (
                  <div className={styles.filterGroups}>
                    {section.groups.map((group) => {
                      const options = Object.entries(facets[group.field] ?? {});
                      return (
                        <fieldset key={group.field} className={styles.filterGroup}>
                          <legend>{fieldLabels[group.field] ?? group.label}</legend>
                          <div className={styles.optionList}>
                            {options.map(([value, count]) => (
                              <label key={value} className={styles.filterOption}>
                                <input
                                  type="checkbox"
                                  checked={selected[group.field]?.includes(value) ?? false}
                                  onChange={() => onToggle(group.field, value)}
                                />
                                <span className={styles.optionLabel}>{value}</span>
                                <span className={styles.optionCount}>{count}</span>
                              </label>
                            ))}
                            {!loading && options.length === 0 && (
                              <span className={styles.noOptions}>{filterMessages.noValues}</span>
                            )}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {range && (
            <section className={styles.rangeSection}>
              <div className={styles.rangeHeading}>
                <span>{range.title}</span>
                <strong>{range.value[0]}–{range.value[1]}{range.unit ?? ""}</strong>
              </div>
              {([0, 1] as const).map((index) => (
                <label key={index} className={styles.rangeRow}>
                  <span>{index === 0 ? "MIN" : "MAX"}</span>
                  <input
                    type="range"
                    min={range.bounds[0]}
                    max={range.bounds[1]}
                    value={range.value[index]}
                    aria-label={`${index === 0 ? "Minimum" : "Maximum"} ${range.title.toLowerCase()}`}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      const next: [number, number] = [...range.value];
                      next[index] = value;
                      if (next[0] > next[1]) next[index === 0 ? 1 : 0] = value;
                      onRangeChange(next);
                    }}
                  />
                </label>
              ))}
              <p>{range.hint}</p>
            </section>
          )}
        </div>
      </div>
    </aside>
  );
}

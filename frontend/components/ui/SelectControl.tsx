"use client";

import { Check, ChevronDown } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import styles from "@/css/SelectControl.module.css";

export interface SelectOption {
  iconSrc?: string;
  label: string;
  value: string;
}

interface SelectControlProps {
  ariaLabel: string;
  className?: string;
  controlSize?: "medium" | "large";
  disabled?: boolean;
  fullWidth?: boolean;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  value: string;
  variant?: "default" | "accent";
}

export function SelectControl({
  ariaLabel,
  className = "",
  controlSize = "medium",
  disabled = false,
  fullWidth = false,
  onValueChange,
  options,
  value,
  variant = "default",
}: SelectControlProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) optionRefs.current[selectedIndex]?.focus();
  }, [isOpen, selectedIndex]);

  function closeListbox() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function openListbox() {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }

  function moveFocus(nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(options.length - 1, nextIndex));
    setActiveIndex(boundedIndex);
    optionRefs.current[boundedIndex]?.focus();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openListbox();
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeListbox();
    }
  }

  function handleListboxKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseOption(options[activeIndex]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      closeListbox();
    }
  }

  function chooseOption(option: SelectOption) {
    onValueChange(option.value);
    closeListbox();
  }

  const selectedOption = options[selectedIndex];
  const controlClassName = [
    styles.control,
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span ref={rootRef} className={controlClassName} data-select-control>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${styles[controlSize]} ${styles[variant]}`}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (isOpen ? closeListbox() : openListbox())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown
          className={`${styles.icon} ${isOpen ? styles.iconOpen : ""}`}
          aria-hidden="true"
          size={17}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          className={`${styles.listbox} ${variant === "accent" ? styles.accentListbox : ""}`}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                type="button"
                className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                role="option"
                aria-selected={selected}
                onClick={() => chooseOption(option)}
                onFocus={() => setActiveIndex(index)}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  {option.iconSrc ? (
                    <Image
                      alt=""
                      className={styles.optionImage}
                      height={24}
                      src={option.iconSrc}
                      width={24}
                    />
                  ) : (
                    <Check
                      className={selected ? styles.checkVisible : styles.check}
                      size={17}
                    />
                  )}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

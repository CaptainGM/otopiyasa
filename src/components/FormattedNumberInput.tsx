"use client";

import { useState, useEffect } from "react";
import { formatNumberInput, parseNumberInput } from "@/lib/form-options";

interface FormattedNumberInputProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function FormattedNumberInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "0",
  className = "input",
  required = false,
}: FormattedNumberInputProps) {
  const isControlled = value !== undefined;
  const initialRaw = String(defaultValue ?? "");
  const [internalRaw, setInternalRaw] = useState(initialRaw);
  const [display, setDisplay] = useState(formatNumberInput(initialRaw));

  useEffect(() => {
    if (isControlled) {
      const raw = String(value ?? "");
      setInternalRaw(raw);
      setDisplay(formatNumberInput(raw));
    }
  }, [value, isControlled]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawText = e.target.value;
    const digits = rawText.replace(/\D/g, "");
    const formatted = formatNumberInput(digits);

    if (!isControlled) {
      setInternalRaw(digits);
    }
    setDisplay(formatted);

    if (onChange) {
      onChange(digits);
    }
  }

  const currentRaw = isControlled ? String(value ?? "") : internalRaw;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentRaw}
        />
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Loader2, Search } from "lucide-react";

export interface AutocompleteOption {
  value: string;
  label: string;
  hint?: string;
}

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Hàm tải danh mục theo từ khóa (đã debounce). Trả về tối đa ~20 dòng. */
  fetcher: (query: string) => Promise<AutocompleteOption[]>;
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Số ký tự tối thiểu để bắt đầu gọi fetcher (mặc định 0 = gọi khi focus). */
  minChars?: number;
}

/**
 * Ô nhập có gợi ý (autocomplete) cho các trường mã danh mục (Ma_Dt, Ma_Kho, Ma_Vt...).
 * - Debounce 300ms (theo plan §8.9 P13) để không spam truy vấn.
 * - Hỗ trợ điều hướng bằng ↑/↓/Enter/Esc.
 */
export const Autocomplete: React.FC<AutocompleteProps> = ({
  label,
  value,
  onChange,
  fetcher,
  onSelect,
  placeholder,
  disabled,
  className,
  minChars = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  // Debounce tải danh mục khi `value`/`open` đổi.
  useEffect(() => {
    if (!open) return;
    const q = (value || "").trim();
    if (q.length < minChars) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const id = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const opts = await fetcher(q);
        if (id === reqIdRef.current) {
          setOptions(opts.slice(0, 20));
          setHighlight(0);
        }
      } catch {
        if (id === reqIdRef.current) setOptions([]);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, open, fetcher, minChars]);

  // Đóng dropdown khi click ra ngoài.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = (opt: AutocompleteOption) => {
    onChange(opt.value);
    onSelect?.(opt);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || options.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="w-full relative" ref={wrapRef}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-600 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full h-7 pl-2 pr-7 text-xs border rounded bg-white text-neutral-900 border-neutral-400 focus:outline-none focus:border-primary-700 focus:ring-1 focus:ring-primary-700 disabled:bg-neutral-100 disabled:text-neutral-500",
            className,
          )}
        />
        <span className="absolute inset-y-0 right-2 flex items-center text-neutral-400 pointer-events-none">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-0.5 w-full max-h-56 overflow-y-auto bg-white border border-neutral-300 rounded shadow-lg text-xs">
          {options.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(opt);
              }}
              className={cn(
                "px-2 py-1 cursor-pointer flex items-center justify-between gap-2",
                i === highlight
                  ? "bg-primary-50 text-primary-800"
                  : "hover:bg-neutral-50",
              )}
            >
              <span className="font-mono font-semibold truncate">
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-neutral-500 truncate max-w-[60%] text-right">
                  {opt.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

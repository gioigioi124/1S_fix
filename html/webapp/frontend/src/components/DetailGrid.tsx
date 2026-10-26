import React, { useCallback, useEffect, useRef } from "react";
import { VoucherDetail } from "../types/voucher";
import { formatCurrency, formatQuantity } from "../lib/format";
import {
  searchProducts,
  getProductByCode,
  initProductIndex,
} from "../lib/productIndex";
import { initCatalogCache, searchKho } from "../lib/catalogCache";
import { Autocomplete, AutocompleteOption } from "./ui/Autocomplete";
import { Trash2 } from "lucide-react";

/** Kết quả tra giá trả về cho DetailGrid (đơn giá ngoại tệ + % chiết khấu). */
export interface PriceLookupResult {
  gia_nt9: number;
  chiet_khau: number;
  expired?: boolean;
}

interface DetailGridProps {
  items: VoucherDetail[];
  currency?: string;
  /** Khi true: bảng lấp đầy chiều cao khung cha (dùng trong split view của ctbhh). */
  embedded?: boolean;
  /** 'list' (ctbhh) hoặc 'form' (ctbhd - thêm cột TK Có / CK / TT). */
  variant?: "list" | "form";
  /** Chế độ sửa dữ liệu (Phase 2) */
  editable?: boolean;
  activeRowIndex?: number;
  onSelectRow?: (index: number) => void;
  onChangeItem?: (
    index: number,
    updatedItem: VoucherDetail,
    fieldName?: string,
  ) => void;
  onDeleteItem?: (index: number) => void;
  onAddItem?: () => void;
  onValidationError?: (message: string | null) => void;
  firstMaVtRef?: React.RefObject<HTMLInputElement | null>;
  /**
   * Tra đơn giá bán & chiết khấu cho một mã vật tư (từ bảng giá VP_2014 BG/BG0).
   * Chỉ được gọi khi ô Đơn giá của dòng đang trống (khớp hành vi VFP).
   */
  onLookupPrice?: (maVt: string) => Promise<PriceLookupResult | null>;
}

export const DetailGrid: React.FC<DetailGridProps> = ({
  items,
  currency = "VND",
  embedded = false,
  variant = "list",
  editable = false,
  activeRowIndex = 0,
  onSelectRow,
  onChangeItem,
  onDeleteItem,
  onAddItem,
  onValidationError,
  firstMaVtRef,
  onLookupPrice,
}) => {
  const amber = "bg-amber-50 text-amber-900 border-amber-200";

  // Fetcher cho ô Mã vật tư: RAM-only (chờ lần nạp index đầu tiên rồi tra RAM).
  // Memo hóa để không tạo tham chiếu mới mỗi render (tránh Autocomplete fetch lặp).
  const fetchVatTuOptions = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initProductIndex();
      return searchProducts(query);
    },
    [],
  );

  // Fetcher cho ô Mã kho: RAM-only.
  const fetchKhoOptionsLocal = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      await initCatalogCache();
      return searchKho(query);
    },
    [],
  );
  const tableRef = useRef<HTMLTableElement | null>(null);
  const maVtInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const pendingFocusRowRef = useRef<number | null>(null);
  // Luôn giữ bản mới nhất của danh sách dòng để tránh callback async (lookup DmVt)
  // ghi đè các ô người dùng đã nhập (Đơn giá/Số lượng/CK...) bằng snapshot cũ.
  const itemsRef = useRef<VoucherDetail[]>(items);
  itemsRef.current = items;

  // Khi tạo dòng mới (từ phím Enter tại ô TT hoặc nút Thêm dòng), tự động focus ngay vào ô Mã vật tư của dòng vừa tạo
  useEffect(() => {
    if (pendingFocusRowRef.current !== null) {
      const targetIdx = pendingFocusRowRef.current;
      const el = maVtInputRefs.current[targetIdx];
      if (el) {
        pendingFocusRowRef.current = null;
        setTimeout(() => {
          el.focus();
          el.select();
        }, 20);
      }
    }
  }, [items.length]);

  // Kiểm tra dữ liệu dòng trước khi cho phép tạo dòng mới
  const validateRow = (
    rowIdx: number,
    trEl?: HTMLTableRowElement | null,
  ): string | null => {
    const it = items[rowIdx];
    if (!it) return "Dòng dữ liệu không tồn tại.";

    if (!it.ma_vt || !it.ma_vt.trim()) {
      return `Dòng ${rowIdx + 1}: Vui lòng nhập Mã vật tư trước khi tạo dòng mới!`;
    }
    if (!it.ten_vt || !it.ten_vt.trim()) {
      return `Dòng ${rowIdx + 1}: Mã vật tư chưa hợp lệ (thiếu Tên vật tư)!`;
    }
    if (!it.dvt || !it.dvt.trim()) {
      return `Dòng ${rowIdx + 1}: Thiếu Đơn vị tính (Đvt)!`;
    }
    if (!(it.tk_du2 || it.tk_du || "").trim()) {
      return `Dòng ${rowIdx + 1}: Thiếu Tài khoản Có (TK Có)!`;
    }
    if (!it.ma_kho || !it.ma_kho.trim()) {
      return `Dòng ${rowIdx + 1}: Vui lòng chọn hoặc nhập Mã kho!`;
    }

    // Kiểm tra có ô input nào trong dòng bị xóa trắng không
    if (trEl) {
      const rowInputs = Array.from(
        trEl.querySelectorAll<HTMLInputElement>("input"),
      );
      for (const inp of rowInputs) {
        if (inp.value.trim() === "") {
          return `Dòng ${rowIdx + 1}: Không được để trống bất kỳ ô nào trong dòng!`;
        }
      }
    }

    const sl9 = Number(it.so_luong9 ?? 0);
    const soTam = Number(it.so_tam ?? 0);
    const heSo8 = Number(it.he_so8 ?? 0);
    const sl8 = Number(it.so_luong8 ?? 0);

    if (isNaN(sl9) || sl9 <= 0) {
      return `Dòng ${rowIdx + 1}: Số lượng phải lớn hơn 0!`;
    }
    if (
      isNaN(soTam) ||
      soTam <= 0 ||
      isNaN(heSo8) ||
      heSo8 <= 0 ||
      isNaN(sl8) ||
      sl8 <= 0
    ) {
      return `Dòng ${rowIdx + 1}: Số tấm, Hệ số và SL bán phải lớn hơn 0!`;
    }

    const giaNt9 = Number(it.gia_nt9 ?? NaN);
    const tienNt9 = Number(it.tien_nt9 ?? NaN);
    const chietKhau = Number(it.chiet_khau ?? NaN);
    if (isNaN(giaNt9) || isNaN(tienNt9) || isNaN(chietKhau)) {
      return `Dòng ${rowIdx + 1}: Đơn giá, Thành tiền hoặc CK % không hợp lệ!`;
    }

    return null;
  };

  const tryAddNewRow = (
    fromRowIdx: number,
    trEl?: HTMLTableRowElement | null,
  ) => {
    const err = validateRow(fromRowIdx, trEl);
    if (err) {
      onValidationError?.(err);
      return;
    }
    onValidationError?.(null);
    pendingFocusRowRef.current = items.length;
    onAddItem?.();
  };

  // Ghi một dòng vào itemsRef NGAY LẬP TỨC (đồng bộ) rồi mới báo lên cha.
  // Nhờ vậy các bước async tiếp theo (tra giá) luôn đọc được bản mới nhất,
  // không bị ghi đè bằng snapshot cũ (mất Tên VT / TK Có vừa enrich).
  const applyRow = (
    idx: number,
    row: VoucherDetail,
    fieldName?: string,
  ) => {
    const next = [...itemsRef.current];
    next[idx] = row;
    itemsRef.current = next;
    onChangeItem?.(idx, row, fieldName);
  };

  // Chỉ tra cứu đầy đủ thông tin vật tư khi người dùng CHỌN từ gợi ý hoặc RỜI Ô (onBlur)
  // Tuyệt đối KHÔNG gọi async ghi đè ma_vt trong lúc người dùng đang gõ từng ký tự!
  const enrichVatTuRow = async (
    idx: number,
    rawCode: string,
    hintTenVt?: string,
  ) => {
    const cleanCode = (rawCode || "").trim().toUpperCase();
    if (!cleanCode) return;

    // 1. Ghi ngay mã + tên để UI phản hồi tức thì (giữ nguyên các ô khác của dòng hiện tại).
    const immediate = itemsRef.current[idx];
    if (!immediate) return;
    applyRow(
      idx,
      {
        ...immediate,
        ma_vt: cleanCode,
        ten_vt: hintTenVt ?? immediate.ten_vt,
        gia_tb_tt: "C",
      },
      "MA_VT",
    );

    // 2. Tra danh mục vật tư NGAY TRONG RAM (Web Worker) — tức thì, không chờ mạng.
    //    Chờ lần nạp index đầu tiên (đã khởi động từ app) rồi tra RAM.
    await initProductIndex();
    const found = await getProductByCode(cleanCode);

    // LẤY LẠI dòng HIỆN TẠI (người dùng có thể đã sửa Đơn giá / Số tấm / Hệ số /
    // SL / Chiết khấu / Mã kho trong lúc chờ). Chỉ hợp nhất trường danh mục.
    const latest = itemsRef.current[idx];
    if (!latest) return;
    // Nếu người dùng đã đổi sang mã vật tư khác trong lúc chờ -> bỏ kết quả cũ.
    if ((latest.ma_vt || "").trim().toUpperCase() !== cleanCode) return;

    if (found) {
      const nextLoaiVt = (found.loai_vt || latest.loai_vt || "1").trim();
      const isMut = nextLoaiVt === "2" || nextLoaiVt === "4";
      const currentSl =
        latest.so_luong9 && latest.so_luong9 > 0 ? latest.so_luong9 : 1;
      applyRow(
        idx,
        {
          ...latest,
          ma_vt: found.ma || cleanCode,
          ten_vt: found.ten || hintTenVt || latest.ten_vt || "",
          dvt: found.dvt || latest.dvt || "",
          dvt_ban: found.dvt_ban || found.dvt || latest.dvt_ban || "",
          loai_vt: nextLoaiVt,
          tk_du2: found.tk_dt || latest.tk_du2 || "5111",
          tk_du: found.tk_vt || latest.tk_du || "1561",
          tk: found.tk_gv || latest.tk || "632",
          tk_du4: found.tk_ck || latest.tk_du4 || undefined,
          he_so9: found.he_so0 || 1.0,
          so_luong9: currentSl,
          so_tam: isMut
            ? (latest.so_tam ?? 0) > 0
              ? latest.so_tam!
              : 1
            : currentSl,
          he_so8: isMut ? ((latest.he_so8 ?? 0) > 0 ? latest.he_so8! : 1) : 1,
          gia_tb_tt: "C",
        },
        "MA_VT_ENRICHED",
      );
    }

    // 3. Tra đơn giá bán & chiết khấu từ bảng giá VP_2014 (BG/BG0).
    //    Chỉ tra khi ô Đơn giá đang trống/0 (khớp VFP: chỉ fill khi Gia_Nt9 rỗng).
    //    Chạy độc lập với bước 2 (BG0 cho phép mã chưa khai báo trong DmVt).
    if (!onLookupPrice) return;
    const priceRow = itemsRef.current[idx];
    if (!priceRow) return;
    if ((priceRow.ma_vt || "").trim().toUpperCase() !== cleanCode) return;
    if (Number(priceRow.gia_nt9 ?? 0) > 0) return;

    const price = await onLookupPrice(cleanCode);
    if (!price) return;

    // Đọc lại dòng mới nhất; bỏ qua nếu người dùng đã đổi mã hoặc đã tự nhập đơn giá.
    const afterPrice = itemsRef.current[idx];
    if (!afterPrice) return;
    if ((afterPrice.ma_vt || "").trim().toUpperCase() !== cleanCode) return;
    if (Number(afterPrice.gia_nt9 ?? 0) > 0) return;

    applyRow(
      idx,
      {
        ...afterPrice,
        gia_nt9: price.gia_nt9,
        chiet_khau: price.chiet_khau,
        gia_tb_tt: "C",
      },
      "GIA_NT9",
    );
  };

  // Handle cell navigation (Enter / Shift+Tab / Ctrl+Shift+Tab / F8)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    isTtCell: boolean = false,
  ) => {
    if (e.key === "F8") {
      e.preventDefault();
      e.stopPropagation();
      onDeleteItem?.(rowIdx);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const current = e.currentTarget;

      // Nếu đang ở ô TT ("C"): kiểm tra dòng hiện tại, hợp lệ thì tạo dòng mới và focus ngay vào Mã vật tư dòng mới
      if (isTtCell) {
        const tr = current.closest("tr");
        tryAddNewRow(rowIdx, tr);
        return;
      }

      const table = current.closest("table");
      if (!table) return;
      const inputs = Array.from(
        table.querySelectorAll<HTMLInputElement>(
          "input.grid-cell-input:not([disabled])",
        ),
      );
      const currIdx = inputs.indexOf(current);
      if (currIdx >= 0 && currIdx < inputs.length - 1) {
        inputs[currIdx + 1].focus();
        inputs[currIdx + 1].select();
      } else if (currIdx === inputs.length - 1) {
        const tr = current.closest("tr");
        tryAddNewRow(rowIdx, tr);
      }
    } else if (
      (e.key === "Tab" && e.shiftKey) ||
      (e.ctrlKey && e.shiftKey && e.key === "Tab")
    ) {
      const current = e.currentTarget;
      const table = current.closest("table");
      if (!table) return;
      const inputs = Array.from(
        table.querySelectorAll<HTMLInputElement>(
          "input.grid-cell-input:not([disabled])",
        ),
      );
      const currIdx = inputs.indexOf(current);
      if (currIdx > 0) {
        e.preventDefault();
        inputs[currIdx - 1].focus();
        inputs[currIdx - 1].select();
      }
    }
  };

  // ===== Biến thể FORM (ctbhd): đã bỏ cột Đvt bán; Disable Đvt & TK Có; TT cố định là "C" =====
  if (variant === "form") {
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="overflow-auto flex-1">
          <table
            ref={tableRef}
            className="w-full text-left dense-table border-collapse text-[11.5px]"
          >
            <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wide select-none border-b border-neutral-300">
              <tr className="divide-x divide-neutral-200">
                <th className="w-9 text-center" scope="col">
                  #
                </th>
                <th className="w-36" scope="col">
                  Mã vật tư
                </th>
                <th className="min-w-[200px]" scope="col">
                  Tên vật tư
                </th>
                <th className="w-16 text-center" scope="col">
                  Đvt
                </th>
                <th className="w-24 text-right" scope="col">
                  Số lượng
                </th>
                <th className="w-16 text-center" scope="col">
                  TK Có
                </th>
                <th className="w-24 text-center" scope="col">
                  Kho
                </th>
                <th className={`w-24 text-right ${amber}`} scope="col">
                  Số tấm
                </th>
                <th className={`w-16 text-right ${amber}`} scope="col">
                  Hệ số
                </th>
                <th className={`w-24 text-right ${amber}`} scope="col">
                  SL bán
                </th>
                <th className="w-28 text-right" scope="col">
                  Đơn giá
                </th>
                <th className="w-32 text-right" scope="col">
                  Thành tiền
                </th>
                <th className="w-14 text-center" scope="col">
                  CK %
                </th>
                <th className="w-10 text-center" scope="col">
                  TT
                </th>
                {editable && (
                  <th
                    className="w-10 text-center"
                    scope="col"
                    title="Xóa dòng (F8)"
                  >
                    Xóa
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono text-neutral-700">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={editable ? 15 : 14}
                    className="px-4 py-8 text-center text-neutral-400 italic text-xs font-sans"
                  >
                    Không có dòng mặt hàng nào.{" "}
                    {editable && onAddItem && (
                      <button
                        type="button"
                        onClick={onAddItem}
                        className="text-primary-700 underline font-semibold ml-1 cursor-pointer"
                      >
                        Thêm dòng mới
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const isActive = editable && idx === activeRowIndex;

                  if (editable) {
                    return (
                      <tr
                        key={it.stt0 || idx}
                        onClick={() => onSelectRow?.(idx)}
                        className={`divide-x divide-neutral-200 transition-colors ${
                          isActive
                            ? "bg-primary-50/50 ring-1 ring-inset ring-primary-500"
                            : "hover:bg-neutral-50"
                        }`}
                      >
                        <td className="py-0.5 text-center font-sans text-neutral-400 font-medium">
                          {idx + 1}
                        </td>
                        {/* Mã vật tư */}
                        <td className="p-0.5">
                          <Autocomplete
                            inputRef={(el) => {
                              maVtInputRefs.current[idx] = el;
                              if (idx === 0 && firstMaVtRef) {
                                (
                                  firstMaVtRef as React.MutableRefObject<HTMLInputElement | null>
                                ).current = el;
                              }
                            }}
                            selectOnFocus
                            value={it.ma_vt || ""}
                            onChange={(val) =>
                              onChangeItem?.(
                                idx,
                                { ...it, ma_vt: val },
                                "MA_VT",
                              )
                            }
                            onSelect={(opt) =>
                              enrichVatTuRow(idx, opt.value, opt.hint)
                            }
                            onBlur={() => {
                              if (it.ma_vt && it.ma_vt.trim()) {
                                enrichVatTuRow(idx, it.ma_vt);
                              }
                            }}
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            fetcher={fetchVatTuOptions}
                            placeholder="Mã VT..."
                            hideIcon
                            openOnTypeOnly
                            debounceMs={30}
                            maxResults={30}
                            className="h-6 px-1.5 py-0.5 text-xs font-mono font-bold text-primary-800 uppercase bg-white border border-neutral-300 rounded focus:border-primary-500 grid-cell-input"
                          />
                        </td>
                        {/* Tên vật tư (Disabled) */}
                        <td className="p-0.5">
                          <input
                            type="text"
                            value={it.ten_vt || ""}
                            disabled
                            readOnly
                            tabIndex={-1}
                            className="w-full px-1.5 py-0.5 text-xs font-sans text-neutral-700 bg-neutral-100 border border-neutral-200 rounded truncate cursor-not-allowed"
                            title={it.ten_vt || ""}
                          />
                        </td>
                        {/* Đvt (Disabled theo yêu cầu) */}
                        <td className="p-0.5">
                          <input
                            type="text"
                            value={it.dvt || ""}
                            disabled
                            readOnly
                            tabIndex={-1}
                            className="w-full px-1 py-0.5 text-xs text-center font-sans text-neutral-600 bg-neutral-100 border border-neutral-200 rounded cursor-not-allowed"
                          />
                        </td>
                        {/* Số lượng (Disabled theo yêu cầu) */}
                        <td className="p-0.5">
                          <input
                            type="number"
                            step="any"
                            value={it.so_luong9 ?? 0}
                            disabled
                            readOnly
                            tabIndex={-1}
                            className="w-full px-1.5 py-0.5 text-xs text-right font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 rounded cursor-not-allowed"
                          />
                        </td>
                        {/* TK Có (Disabled theo yêu cầu) */}
                        <td className="p-0.5">
                          <input
                            type="text"
                            value={it.tk_du2 || it.tk_du || "5111"}
                            disabled
                            readOnly
                            tabIndex={-1}
                            className="w-full px-1 py-0.5 text-xs text-center font-semibold text-primary-700 bg-neutral-100 border border-neutral-200 rounded cursor-not-allowed"
                          />
                        </td>
                        {/* Kho (Autocomplete DmKho) */}
                        <td className="p-0.5">
                          <Autocomplete
                            selectOnFocus
                            value={it.ma_kho || ""}
                            onChange={(val) =>
                              onChangeItem?.(
                                idx,
                                { ...it, ma_kho: val.toUpperCase() },
                                "MA_KHO",
                              )
                            }
                            onSelect={(opt) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  ma_kho: opt.value.trim().toUpperCase(),
                                },
                                "MA_KHO",
                              )
                            }
                            onFocus={() => onSelectRow?.(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            fetcher={fetchKhoOptionsLocal}
                            placeholder="Mã kho..."
                            hideIcon
                            className="h-6 px-1 py-0.5 text-xs text-center font-mono font-semibold text-neutral-800 bg-white border border-neutral-300 rounded uppercase focus:border-primary-500 grid-cell-input"
                          />
                        </td>
                        {/* Số tấm */}
                        <td className={`p-0.5 ${amber}`}>
                          <input
                            type="number"
                            step="any"
                            value={it.so_tam ?? 0}
                            onChange={(e) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  so_tam: parseFloat(e.target.value) || 0,
                                },
                                "SO_TAM",
                              )
                            }
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            className="w-full px-1.5 py-0.5 text-xs text-right font-semibold text-amber-950 bg-amber-50/80 border border-amber-300 rounded focus:border-amber-600 focus:outline-none grid-cell-input"
                          />
                        </td>
                        {/* Hệ số */}
                        <td className={`p-0.5 ${amber}`}>
                          <input
                            type="number"
                            step="any"
                            value={it.he_so8 ?? 1}
                            onChange={(e) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  he_so8: parseFloat(e.target.value) || 0,
                                },
                                "HE_SO8",
                              )
                            }
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            className="w-full px-1 py-0.5 text-xs text-right font-medium text-amber-950 bg-amber-50/80 border border-amber-300 rounded focus:border-amber-600 focus:outline-none grid-cell-input"
                          />
                        </td>
                        {/* SL bán (Disabled / ReadOnly) */}
                        <td className={`p-0.5 ${amber}`}>
                          <input
                            type="number"
                            step="any"
                            value={it.so_luong8 ?? 0}
                            disabled
                            readOnly
                            tabIndex={-1}
                            className="w-full px-1.5 py-0.5 text-xs text-right font-bold text-amber-950 bg-amber-100/50 border border-amber-200 rounded cursor-not-allowed"
                          />
                        </td>
                        {/* Đơn giá */}
                        <td className="p-0.5">
                          <input
                            type="number"
                            step="any"
                            value={it.gia_nt9 ?? 0}
                            onChange={(e) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  gia_nt9: parseFloat(e.target.value) || 0,
                                },
                                "GIA_NT9",
                              )
                            }
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            className="w-full px-1.5 py-0.5 text-xs text-right font-medium text-neutral-800 bg-white border border-neutral-300 rounded focus:border-primary-500 focus:outline-none grid-cell-input"
                          />
                        </td>
                        {/* Thành tiền */}
                        <td className="p-0.5">
                          <input
                            type="number"
                            step="any"
                            value={it.tien_nt9 ?? 0}
                            onChange={(e) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  tien_nt9: parseFloat(e.target.value) || 0,
                                },
                                "TIEN_NT9",
                              )
                            }
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            className="w-full px-1.5 py-0.5 text-xs text-right font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded focus:border-primary-500 focus:outline-none grid-cell-input"
                          />
                        </td>
                        {/* CK % */}
                        <td className="p-0.5">
                          <input
                            type="number"
                            step="any"
                            value={it.chiet_khau ?? 0}
                            onChange={(e) =>
                              onChangeItem?.(
                                idx,
                                {
                                  ...it,
                                  chiet_khau: parseFloat(e.target.value) || 0,
                                },
                                "CHIET_KHAU",
                              )
                            }
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, false)}
                            className="w-full px-1 py-0.5 text-xs text-center font-medium text-neutral-700 bg-white border border-neutral-300 rounded focus:border-primary-500 focus:outline-none grid-cell-input"
                          />
                        </td>
                        {/* TT: luôn cố định là "C", bấm Enter tại ô này sẽ kiểm tra dòng và tạo dòng mới */}
                        <td className="p-0.5">
                          <input
                            type="text"
                            value="C"
                            readOnly
                            onFocus={(e) => {
                              onSelectRow?.(idx);
                              e.currentTarget.select();
                            }}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, true)}
                            title="Cố định là C — Bấm Enter để tạo dòng mới"
                            className="w-full px-1 py-0.5 text-xs text-center font-bold text-success-700 bg-success-50/50 border border-neutral-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500 uppercase grid-cell-input cursor-default"
                          />
                        </td>
                        <td className="py-0.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem?.(idx);
                            }}
                            disabled={items.length <= 1}
                            title="Xóa dòng (F8)"
                            className="p-1 text-neutral-400 hover:text-danger-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Non-editable form row
                  return (
                    <tr
                      key={it.stt0 || idx}
                      className="hover:bg-secondary-50/40 transition-colors divide-x divide-neutral-100"
                    >
                      <td className="py-1 text-center font-sans text-neutral-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-2.5 font-bold text-primary-800">
                        {it.ma_vt}
                      </td>
                      <td
                        className="py-1 px-3 font-sans font-medium text-neutral-800 truncate max-w-[320px]"
                        title={it.ten_vt || ""}
                      >
                        {it.ten_vt || "—"}
                      </td>
                      <td className="py-1 text-center font-sans text-neutral-600">
                        {it.dvt || "—"}
                      </td>
                      <td className="py-1 text-right font-semibold text-neutral-900">
                        {formatQuantity(it.so_luong9)}
                      </td>
                      <td className="py-1 text-center text-primary-700 font-medium">
                        {it.tk_du || it.tk_du2 || "—"}
                      </td>
                      <td className="py-1 text-center font-medium text-neutral-600">
                        {it.ma_kho || "—"}
                      </td>
                      <td className={`py-1 text-right font-medium ${amber}`}>
                        {formatQuantity(it.so_tam)}
                      </td>
                      <td className={`py-1 text-right font-medium ${amber}`}>
                        {formatQuantity(it.he_so8)}
                      </td>
                      <td className={`py-1 text-right font-semibold ${amber}`}>
                        {formatQuantity(it.so_luong8)}
                      </td>
                      <td className="py-1 text-right text-neutral-700">
                        {formatCurrency(it.gia_nt9, currency)}
                      </td>
                      <td className="py-1 text-right font-bold text-neutral-900 bg-neutral-50/60">
                        {formatCurrency(it.tien_nt9, currency)}
                      </td>
                      <td className="py-1 text-center font-sans text-neutral-400">
                        {formatQuantity(it.chiet_khau)}
                      </td>
                      <td className="py-1 text-center font-bold text-success-700 font-sans">
                        C
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ===== Biến thể LIST (ctbhh) =====
  return (
    <div
      className={
        embedded
          ? "w-full h-full flex flex-col bg-white overflow-hidden"
          : "w-full border border-neutral-300 rounded overflow-hidden bg-white flex flex-col"
      }
    >
      <div
        className={
          embedded ? "overflow-auto flex-1" : "overflow-x-auto max-h-[360px]"
        }
      >
        <table className="w-full text-left dense-table border-collapse text-[12.5px]">
          <thead className="bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wider select-none border-b border-neutral-300">
            <tr>
              <th
                className="w-10 text-center border-r border-neutral-200"
                scope="col"
              >
                #
              </th>
              <th
                className="w-36 text-left border-r border-neutral-200 font-mono"
                scope="col"
              >
                Mã vật tư
              </th>
              <th
                className="min-w-[320px] border-r border-neutral-200"
                scope="col"
              >
                Tên vật tư
              </th>
              <th
                className="w-20 text-center border-r border-neutral-200"
                scope="col"
              >
                Mã kho
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                SL xuất
              </th>
              <th
                className="w-20 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Số tấm
              </th>
              <th
                className="w-20 text-center border-r border-neutral-200"
                scope="col"
              >
                Đvt
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Hệ số
              </th>
              <th
                className="w-24 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                SL bán
              </th>
              <th
                className="w-32 text-right border-r border-neutral-200 font-mono"
                scope="col"
              >
                Đơn giá
              </th>
              <th className="w-36 text-right pr-3 font-mono" scope="col">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 font-sans">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-6 text-center text-neutral-400 italic text-xs"
                >
                  Không có dòng mặt hàng nào
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr
                  key={it.stt0 || idx}
                  className="hover:bg-neutral-50 transition"
                >
                  <td className="text-center font-mono text-neutral-400 border-r border-neutral-200 text-xs">
                    {idx + 1}
                  </td>
                  <td className="font-mono text-primary-800 font-semibold border-r border-neutral-200">
                    {it.ma_vt}
                  </td>
                  <td className="font-medium text-neutral-900 border-r border-neutral-200">
                    {it.ten_vt || "—"}
                  </td>
                  <td className="text-center font-mono text-neutral-700 border-r border-neutral-200 font-medium bg-neutral-50/50">
                    {it.ma_kho || "—"}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatQuantity(it.so_luong9)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatQuantity(it.so_tam)}
                  </td>
                  <td className="text-center text-neutral-700 border-r border-neutral-200">
                    {it.dvt || "—"}
                  </td>
                  <td className="text-right font-mono text-neutral-700 border-r border-neutral-200">
                    {formatQuantity(it.he_so8)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200 font-medium">
                    {formatQuantity(it.so_luong8)}
                  </td>
                  <td className="text-right font-mono text-neutral-800 border-r border-neutral-200">
                    {formatCurrency(it.gia_nt9, currency)}
                  </td>
                  <td className="text-right font-mono font-semibold text-neutral-900 pr-3">
                    {formatCurrency(it.tien_nt9, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

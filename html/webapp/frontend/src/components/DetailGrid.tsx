import React from "react";
import { VoucherDetail } from "../types/voucher";
import { formatCurrency, formatQuantity } from "../lib/format";

interface DetailGridProps {
  items: VoucherDetail[];
  currency?: string;
  /** Khi true: bảng lấp đầy chiều cao khung cha (dùng trong split view của ctbhh). */
  embedded?: boolean;
  /** 'list' (ctbhh) hoặc 'form' (ctbhd - thêm cột TK Có / ĐVT bán / CK / TT). */
  variant?: "list" | "form";
}

export const DetailGrid: React.FC<DetailGridProps> = ({
  items,
  currency = "VND",
  embedded = false,
  variant = "list",
}) => {
  // ===== Biến thể FORM (ctbhd): bảng chi tiết dày đặc, nhóm cột Số tấm/Hệ số/SL bán tô nền amber =====
  if (variant === "form") {
    const amber = "bg-tertiary-50 text-tertiary-800 border-tertiary-200";
    return (
      <div className="w-full h-full flex flex-col bg-white overflow-hidden">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left dense-table border-collapse text-[11.5px]">
            <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-600 font-semibold text-[11px] uppercase tracking-wide select-none border-b border-neutral-300">
              <tr className="divide-x divide-neutral-200">
                <th className="w-10 text-center" scope="col">
                  #
                </th>
                <th className="w-32" scope="col">
                  Mã vật tư
                </th>
                <th className="min-w-[200px]" scope="col">
                  Tên vật tư
                </th>
                <th className="w-14 text-center" scope="col">
                  Đvt
                </th>
                <th className="w-16 text-center" scope="col">
                  Đvt bán
                </th>
                <th className="w-24 text-right" scope="col">
                  Số lượng
                </th>
                <th className="w-16 text-center" scope="col">
                  TK Có
                </th>
                <th className="w-16 text-center" scope="col">
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
                <th className="w-12 text-center" scope="col">
                  CK
                </th>
                <th className="w-12 text-center" scope="col">
                  TT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono text-neutral-700">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-4 py-6 text-center text-neutral-400 italic text-xs font-sans"
                  >
                    Không có dòng mặt hàng nào
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
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
                    <td className="py-1 text-center font-sans text-neutral-600">
                      {it.dvt_ban || it.dvt || "—"}
                    </td>
                    <td className="py-1 text-right font-semibold text-neutral-900">
                      {formatQuantity(it.so_luong9)}
                    </td>
                    <td className="py-1 text-center text-primary-700 font-medium">
                      {it.tk_du || "—"}
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
                ))
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

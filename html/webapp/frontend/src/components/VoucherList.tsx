import React, { useState } from "react";
import {
  VoucherHeader,
  VoucherPagination,
  VoucherSummaryTotals,
  VoucherFilterParams,
} from "../types/voucher";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatCurrency, formatDate } from "../lib/format";
import {
  Eye,
  Filter,
  Printer,
  Warehouse,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface VoucherListProps {
  vouchers: VoucherHeader[];
  pagination: VoucherPagination;
  summary: VoucherSummaryTotals;
  filters?: VoucherFilterParams;
  loading: boolean;
  selectedStt: string | null;
  onSelectStt: (stt: string) => void;
  onOpenDetail: (stt: string) => void;
  onOpenFilter: () => void;
  onOpenPrint: (stt: string) => void;
  onOpenPickup: () => void;
  onOpenDebt: (maDt: string) => void;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
}

export const VoucherList: React.FC<VoucherListProps> = ({
  vouchers,
  pagination,
  summary,
  filters,
  loading,
  selectedStt,
  onSelectStt,
  onOpenDetail,
  onOpenFilter,
  onOpenPrint,
  onOpenPickup,
  onOpenDebt,
  onRefresh,
  onChangePage,
}) => {
  const activeVoucher =
    vouchers.find((v) => v.stt === selectedStt) || vouchers[0];

  return (
    <div className="flex flex-col h-full bg-slate-100 pb-10">
      {/* Action Toolbar */}
      <div className="bg-white border-b border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm select-none">
        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => activeVoucher && onOpenDetail(activeVoucher.stt)}
            disabled={!activeVoucher}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Xem chi tiết (Enter)
          </Button>

          <Button variant="outline" size="sm" onClick={onOpenFilter}>
            <Filter className="w-3.5 h-3.5 mr-1" />
            Lọc (F9)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => activeVoucher && onOpenPrint(activeVoucher.stt)}
            disabled={!activeVoucher}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            In phiếu (F7)
          </Button>

          <Button variant="secondary" size="sm" onClick={onOpenPickup}>
            <Warehouse className="w-3.5 h-3.5 mr-1 text-primary-600" />
            Chọn phiếu xuất (Kho)
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => activeVoucher && onOpenDebt(activeVoucher.ma_dt)}
            disabled={!activeVoucher}
          >
            <CreditCard className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Chi tiết công nợ
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
        </div>

        {/* Read-Only Invariant Notice & Active Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-300 font-mono text-[11px]">
            <Filter className="w-3 h-3 text-primary-600" />
            <span>Lọc:</span>
            <strong className="text-primary-800">
              {filters?.ngay_ct1
                ? `${formatDate(filters.ngay_ct1)}` +
                  (filters.ngay_ct2 && filters.ngay_ct2 !== filters.ngay_ct1
                    ? ` → ${formatDate(filters.ngay_ct2)}`
                    : "")
                : "Tất cả ngày"}
            </strong>
            <span className="text-slate-400">|</span>
            <span>Loại:</span>
            <strong className="text-primary-800">
              {filters?.ma_ct || "X1"}
            </strong>
          </span>

          <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            Giai đoạn 1: 100% Read-Only
          </span>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col">
        <div className="flex-1 bg-white border border-slate-300 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1 select-text">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-200 z-10 select-none">
                <tr>
                  <th className="vfp-header w-8 text-center">STT</th>
                  <th className="vfp-header w-24">Số CT</th>
                  <th className="vfp-header w-24">Ngày CT</th>
                  <th className="vfp-header w-24">Mã KH</th>
                  <th className="vfp-header min-w-[200px]">Tên khách hàng</th>
                  <th className="vfp-header w-28">Người mua</th>
                  <th className="vfp-header w-24 text-right">Thuế VAT</th>
                  <th className="vfp-header w-32 text-right">
                    Tổng thanh toán
                  </th>
                  <th className="vfp-header w-20 text-center">Người lập</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-400"
                    >
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                      Đang tải danh sách chứng từ từ CSDL VP_2014...
                    </td>
                  </tr>
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-400 italic"
                    >
                      Không tìm thấy chứng từ bán hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v, idx) => {
                    const isSelected = selectedStt === v.stt;
                    return (
                      <tr
                        key={v.stt}
                        onClick={() => onSelectStt(v.stt)}
                        onDoubleClick={() => onOpenDetail(v.stt)}
                        className={`cursor-pointer transition-colors border-b border-slate-200 ${
                          isSelected
                            ? "bg-amber-100/70 font-medium text-slate-900 border-l-4 border-l-primary-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="vfp-cell text-center text-slate-400 font-mono">
                          {(pagination.page - 1) * pagination.page_size +
                            idx +
                            1}
                        </td>
                        <td className="vfp-cell font-mono font-bold text-primary-700">
                          {v.so_ct || v.stt}
                        </td>
                        <td className="vfp-cell font-mono">
                          {formatDate(v.ngay_ct)}
                        </td>
                        <td className="vfp-cell font-mono">{v.ma_dt}</td>
                        <td className="vfp-cell font-medium">
                          {v.ten_dt || "—"}
                        </td>
                        <td className="vfp-cell text-slate-600">
                          {v.ong_ba || "—"}
                        </td>
                        <td className="vfp-cell text-right font-mono text-sky-700">
                          {formatCurrency(v.ttien_nt3, v.ma_tte)}
                        </td>
                        <td className="vfp-cell text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(v.ttien_nt0, v.ma_tte)}
                        </td>
                        <td className="vfp-cell text-center text-slate-500 font-mono text-[11px]">
                          {v.user_name || "KETOAN"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary & Pagination Bar */}
          <div className="bg-slate-100 border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between text-xs select-none gap-4">
            {/* Totals */}
            <div className="flex items-center gap-4 font-mono font-semibold text-slate-700">
              <span>
                Tổng số chứng từ:{" "}
                <strong className="text-slate-900">
                  {pagination.total_records}
                </strong>
              </span>
              <span>
                Tiền hàng sau CK:{" "}
                <strong className="text-slate-900">
                  {formatCurrency(summary.total_ttien_nt2)} đ
                </strong>
              </span>
              <span>
                Thuế GTGT:{" "}
                <strong className="text-sky-700">
                  +{formatCurrency(summary.total_ttien_nt3)} đ
                </strong>
              </span>
              <span>
                Tổng thanh toán:{" "}
                <strong className="text-emerald-700 text-sm">
                  {formatCurrency(summary.total_ttien_nt0)} đ
                </strong>
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px]">
                Trang {pagination.page} / {pagination.total_pages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangePage(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangePage(pagination.page + 1)}
                disabled={!pagination.has_next || loading}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

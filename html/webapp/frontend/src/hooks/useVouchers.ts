import { useState, useEffect, useCallback } from 'react';
import {
  VoucherHeader,
  VoucherFullDetail,
  VoucherFilterParams,
  VoucherPagination,
  VoucherSummaryTotals,
} from '../types/voucher';
import { getTodayDate } from '../lib/format';

export function useVouchers() {
  const [vouchers, setVouchers] = useState<VoucherHeader[]>([]);
  const [pagination, setPagination] = useState<VoucherPagination>({
    page: 1,
    page_size: 50,
    total_records: 0,
    total_pages: 1,
    has_next: false,
  });
  const [summary, setSummary] = useState<VoucherSummaryTotals>({
    total_ttien_nt: 0,
    total_ttien_nt2: 0,
    total_ttien_nt3: 0,
    total_ttien_nt4: 0,
    total_ttien_nt0: 0,
    total_ttien: 0,
    total_ttien2: 0,
    total_ttien3: 0,
    total_ttien4: 0,
    total_ttien0: 0,
  });
  const today = getTodayDate();
  const [filters, setFilters] = useState<VoucherFilterParams>({
    ma_ct: 'X1',
    ngay_ct1: today,
    ngay_ct2: today,
    page: 1,
    page_size: 50,
  });
  const [selectedStt, setSelectedStt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Active detailed voucher
  const [activeVoucher, setActiveVoucher] = useState<VoucherFullDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modal dialog states
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isPickupOpen, setIsPickupOpen] = useState<boolean>(false);
  const [isDebtOpen, setIsDebtOpen] = useState<boolean>(false);
  const [printStt, setPrintStt] = useState<string>('');
  const [debtMaDt, setDebtMaDt] = useState<string>('');

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.ma_ct) q.append('ma_ct', filters.ma_ct);
      if (filters.ngay_ct1) q.append('ngay_ct1', filters.ngay_ct1);
      if (filters.ngay_ct2) q.append('ngay_ct2', filters.ngay_ct2);
      if (filters.so_ct1) q.append('so_ct1', filters.so_ct1);
      if (filters.so_ct2) q.append('so_ct2', filters.so_ct2);
      if (filters.ma_dt) q.append('ma_dt', filters.ma_dt);
      if (filters.ma_kho) q.append('ma_kho', filters.ma_kho);
      if (filters.ma_vt) q.append('ma_vt', filters.ma_vt);
      if (filters.ma_tte) q.append('ma_tte', filters.ma_tte);
      q.append('page', String(filters.page || 1));
      q.append('page_size', String(filters.page_size || 50));

      const res = await fetch(`/api/vouchers?${q.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setVouchers(data.data.items || []);
        setPagination(data.data.pagination);
        setSummary(data.data.summary);
        if (data.data.items?.length > 0) {
          setSelectedStt((prev) => (data.data.items.some((it: any) => it.stt === prev) ? prev : data.data.items[0].stt));
        } else {
          setSelectedStt(null);
        }
      }
    } catch (err) {
      console.error('Error fetching vouchers list:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedStt]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const fetchVoucherDetail = async (stt: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/vouchers/${encodeURIComponent(stt)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setActiveVoucher(data.data);
      }
    } catch (err) {
      console.error(`Error fetching voucher detail for ${stt}:`, err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenDetail = (stt: string) => {
    setSelectedStt(stt);
    fetchVoucherDetail(stt);
  };

  const handleCloseDetail = () => {
    setActiveVoucher(null);
  };

  const handleApplyFilter = (newFilters: VoucherFilterParams) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1,
    }));
  };

  const handleChangePage = (page: number) => {
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  const handleOpenPrint = (stt: string) => {
    setPrintStt(stt);
    setIsPrintOpen(true);
  };

  const handleOpenDebt = (maDt: string) => {
    setDebtMaDt(maDt);
    setIsDebtOpen(true);
  };

  return {
    vouchers,
    pagination,
    summary,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    activeVoucher,
    loadingDetail,
    handleOpenDetail,
    handleCloseDetail,
    isFilterOpen,
    setIsFilterOpen,
    handleApplyFilter,
    handleChangePage,
    fetchVouchers,
    isPrintOpen,
    setIsPrintOpen,
    printStt,
    handleOpenPrint,
    isPickupOpen,
    setIsPickupOpen,
    isDebtOpen,
    setIsDebtOpen,
    debtMaDt,
    handleOpenDebt,
  };
}

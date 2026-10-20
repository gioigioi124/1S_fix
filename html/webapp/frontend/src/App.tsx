import React, { useState } from 'react';
import { useVouchers } from './hooks/useVouchers';
import { useHotkeys } from './hooks/useHotkeys';
import { VoucherList } from './components/VoucherList';
import { VoucherForm } from './components/VoucherForm';
import { FilterDialog } from './components/FilterDialog';
import { PickupDialog } from './components/PickupDialog';
import { DebtPanel } from './components/DebtPanel';
import { PrintPreview } from './components/PrintPreview';
import { HotkeyBar } from './components/HotkeyBar';
import { Badge } from './components/ui/Badge';
import { Database, User, ShieldCheck } from 'lucide-react';

export function App() {
  const {
    vouchers,
    pagination,
    summary,
    filters,
    loading,
    selectedStt,
    setSelectedStt,
    activeVoucher,
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
  } = useVouchers();

  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // VFP Keyboard Shortcuts Handler
  useHotkeys({
    onF2: () => {
      if (selectedStt && !activeVoucher) {
        handleOpenDetail(selectedStt);
      }
    },
    onF3: () => {
      setIsFilterOpen(true);
    },
    onF4: () => {
      showToast('Tính năng Thêm mới (F4) bị khóa trong Giai đoạn 1 (100% Read-Only).');
    },
    onF7: () => {
      if (activeVoucher) {
        handleOpenPrint(activeVoucher.stt);
      } else if (selectedStt) {
        handleOpenPrint(selectedStt);
      }
    },
    onCtrlF7: () => {
      if (activeVoucher) {
        handleOpenPrint(activeVoucher.stt);
      } else if (selectedStt) {
        handleOpenPrint(selectedStt);
      }
    },
    onF8: () => {
      showToast('Tính năng Xóa (F8) bị khóa trong Giai đoạn 1 (100% Read-Only).');
    },
    onF9: () => {
      setIsFilterOpen(true);
    },
    onEnter: () => {
      if (!activeVoucher && selectedStt) {
        handleOpenDetail(selectedStt);
      }
    },
    onEscape: () => {
      if (isPrintOpen) {
        setIsPrintOpen(false);
      } else if (isDebtOpen) {
        setIsDebtOpen(false);
      } else if (isPickupOpen) {
        setIsPickupOpen(false);
      } else if (isFilterOpen) {
        setIsFilterOpen(false);
      } else if (activeVoucher) {
        handleCloseDetail();
      }
    },
  });

  const handleHotkeyBarAction = (actionId: string) => {
    switch (actionId) {
      case 'VIEW':
        if (selectedStt && !activeVoucher) handleOpenDetail(selectedStt);
        break;
      case 'FILTER':
      case 'FILTER_VOUCHERS':
        setIsFilterOpen(true);
        break;
      case 'NEW':
        showToast('Tính năng Thêm mới (F4) bị khóa trong Giai đoạn 1 (100% Read-Only).');
        break;
      case 'PRINT':
      case 'PREVIEW':
        if (activeVoucher) handleOpenPrint(activeVoucher.stt);
        else if (selectedStt) handleOpenPrint(selectedStt);
        break;
      case 'DELETE':
        showToast('Tính năng Xóa (F8) bị khóa trong Giai đoạn 1 (100% Read-Only).');
        break;
      case 'ESCAPE':
        if (isPrintOpen) setIsPrintOpen(false);
        else if (isDebtOpen) setIsDebtOpen(false);
        else if (isPickupOpen) setIsPickupOpen(false);
        else if (isFilterOpen) setIsFilterOpen(false);
        else if (activeVoucher) handleCloseDetail();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2 rounded shadow-lg text-xs flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Application Header */}
      <header className="h-10 bg-slate-900 text-white flex items-center justify-between px-4 select-none shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-sm tracking-wide text-primary-400">
            <Database className="w-4 h-4" />
            <span>1S SALES WEB APP</span>
          </div>
          <span className="text-slate-500 text-xs">|</span>
          <span className="text-xs text-slate-300 font-medium">
            Quản Lý Chứng Từ Bán Hàng (ctbhh / ctbhd)
          </span>
          <Badge variant="warning" className="ml-2 font-mono text-[10px]">
            GĐ1: READ-ONLY
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono text-slate-400">CSDL: VP_2014 & KH_2014</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            <User className="w-3.5 h-3.5 text-primary-400" />
            <span className="font-semibold text-slate-200">KETOAN01</span>
            <span className="text-slate-400 text-[10px]">(ĐVCS: 01)</span>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeVoucher ? (
          <VoucherForm
            voucher={activeVoucher}
            onBack={handleCloseDetail}
            onPrint={() => handleOpenPrint(activeVoucher.stt)}
            onViewDebt={(maDt) => handleOpenDebt(maDt)}
          />
        ) : (
          <VoucherList
            vouchers={vouchers}
            pagination={pagination}
            summary={summary}
            filters={filters}
            loading={loading}
            selectedStt={selectedStt}
            onSelectStt={setSelectedStt}
            onOpenDetail={handleOpenDetail}
            onOpenFilter={() => setIsFilterOpen(true)}
            onOpenPrint={handleOpenPrint}
            onOpenPickup={() => setIsPickupOpen(true)}
            onOpenDebt={handleOpenDebt}
            onRefresh={fetchVouchers}
            onChangePage={handleChangePage}
          />
        )}
      </main>

      {/* Modals */}
      <FilterDialog
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilter}
      />

      <PickupDialog
        isOpen={isPickupOpen}
        onClose={() => setIsPickupOpen(false)}
        onAccept={(_slips, _items) => {
          showToast('Đã lấy đơn từ kho (Giai đoạn 1: Chỉ xem cấu trúc phiếu xuất).');
        }}
      />

      <DebtPanel
        isOpen={isDebtOpen}
        onClose={() => setIsDebtOpen(false)}
        maDt={debtMaDt}
      />

      <PrintPreview
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        stt={printStt}
      />

      {/* Persistent VFP Bottom Hotkeys Hint Bar */}
      <HotkeyBar onAction={handleHotkeyBarAction} />
    </div>
  );
}

export default App;

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route nghiệp vụ (plan §1.4): danh sách + chi tiết/sửa phiếu */}
        <Route path="/sales-invoices" element={<App />} />
        <Route path="/sales-invoices/:stt" element={<App />} />
        <Route path="*" element={<Navigate to="/sales-invoices" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

// src/hooks/useGlobalError.js
import { useState, useEffect } from 'react';

export const useGlobalError = () => {
      const [toast, setToast] = useState({ visible: false, message: '', type: 'error' });

      useEffect(() => {
      // Hàm kích hoạt hiển thị Toast nội bộ
      const showToast = (msg, type = 'error') => {
            setToast({ visible: true, message: msg, type });
            
            setTimeout(() => {
                  setToast((prev) => ({ ...prev, visible: false }));
            }, 4000);
      };

      // 1. Thực hiện ghi đè hàm window.alert gốc
      const originalAlert = window.alert;
      window.alert = (msg) => showToast(msg, 'warning');

      // 2. Lắng nghe các lỗi đồng bộ / lỗi cú pháp hệ thống
      const handleGlobalError = (event) => {
            showToast(`Lỗi hệ thống: ${event.message}`, 'error');
      };

      // 3. Lắng nghe các lỗi bất đồng bộ (Async/Promise Rejection)
      const handleUnhandledRejection = (event) => {
            showToast(`Lỗi tác vụ: ${event.reason?.message || 'Không thể thực thi!'}`, 'error');
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      // Dọn dẹp bộ nhớ và hoàn trả lại trạng thái window ban đầu khi unmount
      return () => {
            window.alert = originalAlert;
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
      }, []);

      return toast;
};
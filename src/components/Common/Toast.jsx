import React from 'react';

export const Toast = ({ visible, message, type }) => {
      return (
      <>
            {/* Chỉ định Keyframe Animation cục bộ cho Toast */}
            <style>{`
                  @keyframes slideDownFade {
                  0% { top: -50px; opacity: 0; transform: translateX(-50%) scale(0.9); }
                  100% { top: 20px; opacity: 1; transform: translateX(-50%) scale(1); }
                  }
            `}</style>

            <div style={{
                  position: 'fixed',
                  top: visible ? '20px' : '-50px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  opacity: visible ? 1 : 0,
                  zIndex: 9999,
                  background: type === 'error' ? 'rgba(255, 0, 0, 0.15)' : 'rgba(255, 165, 0, 0.15)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${type === 'error' ? '#ff4757' : '#ffa502'}`,
                  boxShadow: `0 0 20px ${type === 'error' ? 'rgba(255, 71, 87, 0.4)' : 'rgba(255, 165, 2, 0.4)'}`,
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  pointerEvents: visible ? 'auto' : 'none',
                  transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                  animation: visible ? 'slideDownFade 0.4s ease-out' : 'none'
            }}>
            <span>{type === 'error' ? '❌' : '⚠️'}</span>
                  {message}
            </div>
      </>
      );
};
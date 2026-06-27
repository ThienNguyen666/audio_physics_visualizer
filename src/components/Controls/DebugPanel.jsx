import React from "react";

export const DebugPanel = ({ isDebugMode, onToggle }) => {
      return (
            <div style = {styles.container}>
                  <label style = {styles.label}>
                        <input
                              type = "checkbox"
                              checked = {isDebugMode}
                              onChange = {onToggle}
                              style = {styles.checkbox}
                        />
                        Visual Debug Mode
                  </label>
            </div>
      )
}

const styles = {
      container: {
            background: 'rgba(255, 0, 0, 0.15)',
            padding: '12px',
            borderRadius: '8px',
            color: 'white',
            border: '1px solid rgba(255,0,0,0.3)',
            backdropFilter: 'blur(10px)'
      },
      label: { 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            fontSize: '14px', 
            fontWeight: 'bold' 
      },
      checkbox: { 
            marginRight: '10px', 
            width: '16px', 
            height: '16px' 
      }
};
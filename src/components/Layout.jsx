import React from "react";

export const Layout = ({ children, controls }) => {
      return (
            <div style = {styles.wrapper}>
                  <div style={styles.canvasLayer}>
                        {children}
                  </div>

                  <div style={styles.controlsLayer}>
                        {controls}
                  </div>
            </div>
      )
}

const styles = {
      wrapper: {
            position: 'relative',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: '#000'
      },
            canvasLayer: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
      },
            controlsLayer: {
            position: 'absolute',
            top: 20,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            zIndex: 10,
            width: '280px'
      }
};
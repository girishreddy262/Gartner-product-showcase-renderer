import React from 'react';
import type { Callout as CalloutType } from '../types';

export const CalloutComp: React.FC<{ callout: CalloutType }> = ({ callout }) => {
  return (
    <div style={{
      position: 'absolute',
      left: callout.x || 0,
      top: callout.y || 0,
      minWidth: 367,
      width: callout.width || 367,
      borderRadius: 20,
      background: 'linear-gradient(90deg, #0183FF 0%, #006DD5 100%)',
      border: '2px solid #FDDB5D',
      boxShadow: '6px 6px 0 0 rgba(0,109,213,0.4)',
      color: '#fff',
      fontFamily: "'Satoshi', sans-serif",
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.25,
      padding: '32px 48px',
      boxSizing: 'border-box' as const,
      wordWrap: 'break-word' as const,
      textAlign: 'center' as const,
      zIndex: 50,
    }}>
      {callout.text || 'Callout'}
    </div>
  );
};

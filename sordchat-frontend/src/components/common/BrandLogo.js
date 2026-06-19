import React from 'react';

const publicUrl = process.env.PUBLIC_URL || '';
export const brandMarkSrc = `${publicUrl}/brand/LOGO.jpeg`;
export const brandLogoSrc = `${publicUrl}/brand/ICO.jpeg`;

const BrandLogo = ({ subtitle = 'Workspace corporativo', showText = true, className = '', textClassName = '' }) => (
  <span className={`brand-lockup ${className}`.trim()}>
    <img className="brand-mark brand-mark--full" src={brandLogoSrc} alt="Volt Corp" />
    {showText && subtitle && (
      <span className={`brand-copy ${textClassName}`.trim()}>
        <small>{subtitle}</small>
      </span>
    )}
  </span>
);

export default BrandLogo;

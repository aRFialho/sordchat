import React from 'react';

const publicUrl = process.env.PUBLIC_URL || '';
export const brandMarkSrc = `${publicUrl}/brand/voltcorp-mark.svg`;
export const brandLogoSrc = `${publicUrl}/brand/voltcorp-logo.svg`;

const BrandLogo = ({ subtitle = 'Workspace corporativo', showText = true, className = '', textClassName = '' }) => (
  <span className={`brand-lockup ${className}`.trim()}>
    <img className="brand-mark" src={brandMarkSrc} alt="" aria-hidden="true" />
    {showText && (
      <span className={`brand-copy ${textClassName}`.trim()}>
        <strong>Volt Corp</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    )}
  </span>
);

export default BrandLogo;

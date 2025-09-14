import React, { useState, useEffect } from 'react';

const LOGO_URL = "https://raw.githubusercontent.com/iFinklestein/domestIQ/main/public/domestiq-dark-bg.svg";

export default function BrandLogo({ variant = "desktop" }) {
  const [svg, setSvg] = useState(null);
  
  useEffect(() => {
    fetch(LOGO_URL)
      .then(response => response.text())
      .then(svgText => setSvg(svgText))
      .catch(() => setSvg(null));
  }, []);

  const cls = variant === "mobile"
    ? "h-7 w-auto block max-w-none"
    : "h-10 md:h-12 lg:h-12 w-auto block max-w-none";

  return (
    <div className={`brand-logo ${variant === "mobile" ? "mobile" : "desktop"}`}>
      {svg ? (
        <div 
          className={cls} 
          style={{ display: "inline-block" }} 
          dangerouslySetInnerHTML={{ __html: svg }} 
        />
      ) : (
        <span className="text-white font-semibold">domestiQ</span>
      )}
    </div>
  );
}
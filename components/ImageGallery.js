// components/ImageGallery.js
import React from "react";

export default function ImageGallery({ images }) {
  if (!images || images.length === 0) {
    return <p className="text-sm text-gray-500">No images uploaded.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={`asset-${idx}`}
          className="object-cover rounded shadow"
        />
      ))}
    </div>
  );
}

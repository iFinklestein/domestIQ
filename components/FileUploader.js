// components/FileUploader.js
import React from "react";

export default function FileUploader({ onUpload }) {
  return (
    <div>
      <input
        type="file"
        multiple
        onChange={(e) => onUpload([...e.target.files])}
        className="block w-full text-sm text-gray-500
                   file:mr-4 file:py-2 file:px-4
                   file:rounded file:border-0
                   file:text-sm file:font-semibold
                   file:bg-blue-50 file:text-blue-700
                   hover:file:bg-blue-100"
      />
    </div>
  );
}

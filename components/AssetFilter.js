// components/AssetFilter.js
import React from "react";

export default function AssetFilter({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="text"
        placeholder="Search assets..."
        className="border rounded p-2"
        value={filters.search || ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      {/* Additional dropdowns for category/location/etc could go here */}
    </div>
  );
}

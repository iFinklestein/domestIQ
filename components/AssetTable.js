// components/AssetTable.js
import React from "react";

export default function AssetTable({ assets, onView, onEdit, onDelete }) {
  if (!assets || assets.length === 0) {
    return <p className="text-sm text-gray-500">No assets found.</p>;
  }

  return (
    <table className="min-w-full border">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2 border">Name</th>
          <th className="px-4 py-2 border">Serial Number</th>
          <th className="px-4 py-2 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.id}>
            <td className="px-4 py-2 border">{asset.name}</td>
            <td className="px-4 py-2 border">{asset.serialNumber}</td>
            <td className="px-4 py-2 border space-x-2">
              <button onClick={() => onView(asset)}>View</button>
              <button onClick={() => onEdit(asset)}>Edit</button>
              <button onClick={() => onDelete(asset)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

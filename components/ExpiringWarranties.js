// components/ExpiringWarranties.js
import React from "react";

export default function ExpiringWarranties({ warranties }) {
  if (!warranties || warranties.length === 0) {
    return <p className="text-sm text-gray-500">No expiring warranties.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200">
      {warranties.map((warranty) => (
        <li key={warranty.id} className="py-2">
          <p className="font-medium">{warranty.providerName}</p>
          <p className="text-sm text-gray-500">Expires: {warranty.endDate}</p>
        </li>
      ))}
    </ul>
  );
}

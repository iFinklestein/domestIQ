// components/InfoCard.js
import React from "react";

export default function InfoCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

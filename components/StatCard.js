// components/StatCard.js
import React from "react";

export default function StatCard({ title, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 flex flex-col items-center justify-center">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

import React from 'react';
import { FiFileText, FiCheckCircle, FiUpload, FiUsers } from 'react-icons/fi';

const SummaryCards = ({ summary }) => {
  const cards = [
    {
      title: 'Private Keywords',
      value: summary?.totalKeywordsSubmitted || 0,
      icon: <FiUpload className="w-8 h-8" />,
      gradient: 'from-orange-400 to-orange-600',
      rateLabel: 'Avg per user',
      rateValue: summary?.totalUsers > 0
        ? ((summary?.totalKeywordsSubmitted || 0) / summary.totalUsers).toFixed(1)
        : '0.0',
      showPercent: false,
    },
    {
      title: 'Total Suggestions',
      value: summary?.totalSuggestions || 0,
      icon: <FiFileText className="w-8 h-8" />,
      gradient: 'from-blue-400 to-blue-600',
      rateLabel: 'Rate',
      rateValue: '100.0',
    },
    {
      title: 'Approved',
      value: summary?.totalApproved || 0,
      icon: <FiCheckCircle className="w-8 h-8" />,
      gradient: 'from-green-400 to-green-600',
      rateLabel: 'Rate',
      rateValue: summary?.totalSuggestions > 0
        ? (((summary?.totalApproved || 0) / summary.totalSuggestions) * 100).toFixed(1)
        : '0.0',
    },
    {
      title: 'Total Users',
      value: summary?.totalUsers || 0,
      icon: <FiUsers className="w-8 h-8" />,
      gradient: 'from-purple-400 to-purple-600',
      rateLabel: 'Rate',
      rateValue: summary?.totalSuggestions > 0
        ? (((summary?.totalUsers || 0) / summary.totalSuggestions) * 100).toFixed(1)
        : '0.0',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300"
        >
          <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
            <div className="flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm font-medium opacity-90">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value.toLocaleString()}</p>
              </div>
              <div className="text-white opacity-80">
                {card.icon}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{card.rateLabel}:</span>
              <span className="font-semibold">{card.rateValue}{card.showPercent === false ? '' : '%'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;

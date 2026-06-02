import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const KeywordChart = ({ data, chartType: initialChartType = 'line' }) => {
  const [chartType, setChartType] = useState(initialChartType);

  const formattedData = data?.map((item) => ({
    ...item,
    displayDate: format(new Date(item.date), 'dd/MM', { locale: vi }),
  })) || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = data?.find(d => format(new Date(d.date), 'dd/MM', { locale: vi }) === label)?.date;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-800 mb-2">
            {date ? format(new Date(date), 'dd MMMM yyyy', { locale: vi }) : label}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{entry.name}:</span>{' '}
              <span className="font-bold">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data: formattedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="displayDate"
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 12 }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Bar
            dataKey="suggestions"
            fill="#f97316"
            name="Suggestions"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="approved"
            fill="#10b981"
            name="Approved"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      );
    }

    return (
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#d1d5db' }}
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickLine={{ stroke: '#d1d5db' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="suggestions"
          stroke="#f97316"
          strokeWidth={3}
          name="Suggestions"
          dot={{ fill: '#f97316', r: 5 }}
          activeDot={{ r: 8 }}
        />
        <Line
          type="monotone"
          dataKey="approved"
          stroke="#10b981"
          strokeWidth={3}
          name="Approved"
          dot={{ fill: '#10b981', r: 5 }}
          activeDot={{ r: 8 }}
        />
      </LineChart>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 md:mb-0">
          Statistics Over Time
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('line')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              chartType === 'line'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Line Chart
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Bar Chart
          </button>
        </div>
      </div>

      <div className="w-full h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Total Suggestions</p>
          <p className="text-2xl font-bold text-orange-600">
            {data?.reduce((sum, item) => sum + item.suggestions, 0) || 0}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Total Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {data?.reduce((sum, item) => sum + item.approved, 0) || 0}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Average per Day</p>
          <p className="text-2xl font-bold text-blue-600">
            {data?.length > 0
              ? Math.round(data.reduce((sum, item) => sum + item.suggestions, 0) / data.length)
              : 0}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600">Approval Rate</p>
          <p className="text-2xl font-bold text-purple-600">
            {data?.length > 0
              ? (
                  (data.reduce((sum, item) => sum + item.approved, 0) /
                    data.reduce((sum, item) => sum + item.suggestions, 0)) *
                  100
                ).toFixed(1)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeywordChart;


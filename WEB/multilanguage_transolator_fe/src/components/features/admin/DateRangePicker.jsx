import React, { useState } from "react";
import { DatePicker, Select } from "antd";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import PropTypes from "prop-types";

const { RangePicker } = DatePicker;

const DateRangePicker = ({ onDateRangeChange, compact = false }) => {
  const [selectedRange, setSelectedRange] = useState("30days");
  const [customDates, setCustomDates] = useState(null);

  const presetRanges = [
    { label: "Last 7 days", value: "7days" },
    { label: "Last 30 days", value: "30days" },
    { label: "Custom", value: "custom" },
  ];

  const getDateRange = (range) => {
    const now = new Date();
    let start, end;

    switch (range) {
      case "7days":
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
        break;
      case "30days":
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
        break;
      default:
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
    }

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  };

  const handlePresetChange = (range) => {
    setSelectedRange(range);
    if (range !== "custom") {
      const dateRange = getDateRange(range);
      onDateRangeChange(dateRange.start, dateRange.end);
    }
  };

  const handleCustomDateChange = (dates) => {
    if (dates && dates.length === 2) {
      setCustomDates(dates);
      const start = format(dates[0].toDate(), "yyyy-MM-dd");
      const end = format(dates[1].toDate(), "yyyy-MM-dd");
      onDateRangeChange(start, end);
    }
  };

  React.useEffect(() => {
    // Initialize with default range (last 30 days)
    const defaultRange = getDateRange("30days");
    onDateRangeChange(defaultRange.start, defaultRange.end);
  }, [onDateRangeChange]);

  // Compact mode - for header integration
  if (compact) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Time Period:
          </span>
          <Select
            value={selectedRange}
            onChange={handlePresetChange}
            className="w-48"
            size="large"
            options={presetRanges.map((range) => ({
              label: range.label,
              value: range.value,
            }))}
            placeholder="Select time range"
          />
        </div>

        {selectedRange === "custom" && (
          <RangePicker
            onChange={handleCustomDateChange}
            value={customDates}
            format="DD/MM/YYYY"
            size="large"
            placeholder={["From date", "To date"]}
          />
        )}
      </div>
    );
  }

  // Normal mode - standalone card
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Time Filter</h3>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <Select
          value={selectedRange}
          onChange={handlePresetChange}
          className="w-full sm:w-64"
          size="large"
          options={presetRanges.map((range) => ({
            label: range.label,
            value: range.value,
          }))}
          placeholder="Select time range"
        />

        {selectedRange === "custom" && (
          <div className="w-full sm:w-auto">
            <RangePicker
              onChange={handleCustomDateChange}
              value={customDates}
              format="DD/MM/YYYY"
              className="w-full sm:w-auto"
              size="large"
              placeholder={["From date", "To date"]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;

DateRangePicker.propTypes = {
  onDateRangeChange: PropTypes.func.isRequired,
  compact: PropTypes.bool,
};

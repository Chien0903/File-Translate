import { useState, useCallback, useRef } from "react";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import DateRangePicker from "../../components/features/admin/DateRangePicker";
import SummaryCards from "../../components/features/admin/SummaryCards";
import UserStatsTable from "../../components/features/admin/UserStatsTable";
import KeywordChart from "../../components/features/admin/KeywordChart";
import { keywordStatsService } from "../../services/keywordStatsService";
import { toast } from "react-toastify";
import "../../styles/adminDashboard.css";

const KeywordStatsAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);
  const debounceTimerRef = useRef(null);

  const fetchData = useCallback(async (startDate, endDate) => {
    if (!startDate || !endDate) return;

    // Hiển thị spinner nhỏ nếu đã có dữ liệu, spinner lớn nếu lần tải đầu
    if (hasLoadedRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await keywordStatsService.getKeywordStats(
        startDate,
        endDate
      );
      setData(result);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Unable to load data. Please try again later.");
      toast.error("Unable to load statistics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDateRangeChange = useCallback(
    (start, end) => {
      // Debounce để tránh gọi API dồn dập khi người dùng thao tác nhanh
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchData(start, end);
      }, 300);
    },
    [fetchData]
  );

  return (
    <div className="w-full h-full relative">
      {/* Page Header with Integrated Time Filter */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-800">
              Keyword Statistics Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Monitor and analyze keyword suggestions from users
            </p>
          </div>

          {/* Inline Time Filter */}
          <div className="flex-shrink-0">
            <DateRangePicker
              onDateRangeChange={handleDateRangeChange}
              compact
            />
          </div>
        </div>

        {/* Spinner nhỏ khi đang refresh dữ liệu */}
        {refreshing && (
          <div className="absolute right-6 top-6">
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />}
              tip="Updating..."
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Loading lần đầu: hiển thị spinner giữa trang */}
        {loading && !data && (
          <div className="bg-white rounded-lg shadow-sm p-20 flex items-center justify-center">
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
              tip="Loading data..."
            />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 ml-4 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Data Display - luôn giữ dữ liệu cũ khi refresh */}
        {data && !error && (
          <>
            {/* Summary Cards */}
            <SummaryCards summary={data.summary} />

            {/* Chart */}
            <KeywordChart data={data.dailyStats} />

            {/* User Stats Table */}
            <UserStatsTable data={data.userStats} />
          </>
        )}

        {/* Empty State */}
        {!loading && !error && !data && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-24 w-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Data Available
            </h3>
            <p className="text-gray-500">
              Please select a time range to view statistics
            </p>
          </div>
        )}

        {/* User Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">📊 Quick Guide:</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>
              Use the time period filter in the header to select date range
            </li>
            <li>Click on column headers in the table to sort data</li>
            <li>
              Use the search box to filter by username, email, or department
            </li>
            <li>Click &quot;Export CSV&quot; to download data as Excel file</li>
            <li>Hover over the chart to see detailed stats for each day</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KeywordStatsAdmin;

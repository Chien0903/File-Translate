import React, { useState, useMemo } from 'react';
import { Table, Button, Select } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { FiSearch, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import { keywordStatsService } from '../../../services/keywordStatsService';

const { Option } = Select;

const UserStatsTable = ({ data }) => {
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('suggestions');
  const [sortOrder, setSortOrder] = useState('descend');

  const filteredData = useMemo(() => {
    if (!data) return [];
    
    return data.filter(
      (item) =>
        item.username.toLowerCase().includes(searchText.toLowerCase()) ||
        item.email.toLowerCase().includes(searchText.toLowerCase()) ||
        (item.department && item.department.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [data, searchText]);

  const handleExport = () => {
    keywordStatsService.exportToCSV(filteredData, `keyword-stats-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const columns = [
    {
      title: <div className="text-center">No.</div>,
      key: 'index',
      width: 70,
      align: 'center',
      render: (text, record, index) => index + 1,
      fixed: 'left',
    },
    {
      title: <div className="text-center">Username</div>,
      dataIndex: 'username',
      key: 'username',
      width: 180,
      sorter: (a, b) => a.username.localeCompare(b.username),
      fixed: 'left',
      render: (text, record) => (
        <div>
          <div className="font-semibold text-gray-800">{text}</div>
          <div className="text-xs text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: <div className="text-center">Department</div>,
      dataIndex: 'department',
      key: 'department',
      width: 180,
      sorter: (a, b) => (a.department || '').localeCompare(b.department || ''),
      render: (text) => (
        <div className="text-gray-700">
          {text || <span className="text-gray-400 italic">N/A</span>}
        </div>
      ),
    },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <span>Suggestions</span>
          <FiFileText className="text-blue-500" />
        </div>
      ),
      dataIndex: 'suggestions',
      key: 'suggestions',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.suggestions - b.suggestions,
      defaultSortOrder: 'descend',
      render: (value) => (
        <span className="font-semibold text-blue-600 text-lg">{value}</span>
      ),
    },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <span>Approved</span>
          <FiCheckCircle className="text-green-500" />
        </div>
      ),
      dataIndex: 'approved',
      key: 'approved',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.approved - b.approved,
      render: (value) => (
        <span className="font-semibold text-green-600">{value}</span>
      ),
    },
    {
      title: (
        <div className="flex items-center justify-center gap-2">
          <span>Rejected</span>
          <FiXCircle className="text-red-500" />
        </div>
      ),
      dataIndex: 'rejected',
      key: 'rejected',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.rejected - b.rejected,
      render: (value) => (
        <span className="font-semibold text-red-600">{value}</span>
      ),
    },
    {
      title: <div className="text-center">Approval Rate (%)</div>,
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 140,
      align: 'center',
      sorter: (a, b) => parseFloat(a.approvalRate) - parseFloat(b.approvalRate),
      render: (value) => {
        const rate = parseFloat(value);
        let colorClass = 'text-gray-600';
        if (rate >= 80) colorClass = 'text-green-600';
        else if (rate >= 60) colorClass = 'text-yellow-600';
        else if (rate >= 40) colorClass = 'text-orange-600';
        else colorClass = 'text-red-600';

        return (
          <div className="flex items-center justify-center">
            <div className={`font-bold ${colorClass}`}>
              {value}%
            </div>
          </div>
        );
      },
    },
    {
      title: <div className="text-center">Last Suggestion Date</div>,
      dataIndex: 'lastSuggestionDate',
      key: 'lastSuggestionDate',
      width: 160,
      align: 'center',
      sorter: (a, b) => new Date(a.lastSuggestionDate) - new Date(b.lastSuggestionDate),
      render: (date) => (
        <span className="text-gray-600">
          {format(new Date(date), 'dd/MM/yyyy')}
        </span>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-800">
            User Statistics
          </h3>
          
          <div className="flex flex-wrap items-center gap-[1rem]">
            {/* Search Input */}
            <div className="relative w-[20rem]">
              <FiSearch className="absolute left-[0.75rem] top-[0.75rem] text-gray-500 z-10" />
              <input
                type="text"
                placeholder="Search by username, email, or department..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-[2.5rem] pr-[0.75rem] py-[0.5rem] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0477BF] focus:border-transparent"
              />
            </div>
            
            {/* Rows per page */}
            <Select
              value={pageSize}
              onChange={setPageSize}
              style={{ width: 120 }}
            >
              <Option value={10}>10 rows</Option>
              <Option value={25}>25 rows</Option>
              <Option value={50}>50 rows</Option>
              <Option value={100}>100 rows</Option>
            </Select>
            
            {/* Export CSV Button */}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: pageSize,
            showSizeChanger: false,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
            position: ['bottomCenter'],
          }}
          scroll={{ x: 1400 }}
          bordered
          size="middle"
          className="custom-table"
        />
      </div>


    </div>
  );
};



export default UserStatsTable;

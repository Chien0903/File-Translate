import { useState, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";
import {
  FiSearch,
  FiChevronDown,
  FiArrowUp,
  FiArrowDown,
  FiDownload,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import userService from "../../services/userService";
import { toast } from "react-toastify";
import Pagination from "../../components/Pagination";
import EditUserRole from "../../components/features/admin/editUserRole";
import * as XLSX from "xlsx";
import { useAuth } from "../../hooks/useAuth";
import CreateAccountModal from "../../components/features/admin/CreateAccountModal";

function AccountManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [sortField, setSortField] = useState("date_joined");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(true);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);
  const [filterDepartment, setFilterDepartment] = useState("");
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false);
  const departmentDropdownRef = useRef(null);

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    role: "User",
  });

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);

  // Add a click outside handler to close the dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target)
      ) {
        setIsRoleDropdownOpen(false);
      }
      if (
        departmentDropdownRef.current &&
        !departmentDropdownRef.current.contains(event.target)
      ) {
        setIsDepartmentDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const { role: userRole } = useAuth();

  useEffect(() => {
    if (userRole !== "Admin") {
      toast.error("Access denied");
      navigate("/");
    }
  }, [navigate, userRole]);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounce search to smooth filtering and reset to first page
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers();
      const usersWithFullName = response.data.map((user) => ({
        ...user,
        full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      }));
      setUser(usersWithFullName);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?"))
      return;
    try {
      await userService.deleteUser(id);
      toast.success("Account deleted");
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete account");
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();

    if (
      !newAccount.firstName ||
      !newAccount.lastName ||
      !newAccount.email ||
      !newAccount.department
    ) {
      toast.error("All fields are required!");
      return;
    }

    // Client-side quick duplicate check to show error immediately
    const newEmail = (newAccount.email || "").trim().toLowerCase();
    if (
      newEmail &&
      user.some((u) => (u.email || "").trim().toLowerCase() === newEmail)
    ) {
      toast.error("Email already exists. Please use another email.");
      return;
    }

    try {
      await userService.createUser({
        first_name: newAccount.firstName,
        last_name: newAccount.lastName,
        email: newAccount.email,
        department: newAccount.department,
        role: newAccount.role,
      });

      toast.success("Account created successfully!");

      fetchUsers();
      setIsAddingAccount(false);
      setNewAccount({
        firstName: "",
        lastName: "",
        email: "",
        department: "",
        role: "User",
      });
    } catch (error) {
      const apiData = error?.response?.data || {};
      const status = error?.response?.status;

      // Detect duplicate/unique email errors
      const emailErrors = Array.isArray(apiData?.email)
        ? apiData.email
        : apiData?.email
          ? [apiData.email]
          : [];
      const emailErrorText = emailErrors.join(" ").toLowerCase();

      let message = "";
      if (
        emailErrorText.includes("exist") ||
        emailErrorText.includes("unique") ||
        emailErrorText.includes("duplicate") ||
        (typeof apiData?.detail === "string" &&
          /email/.test(apiData.detail.toLowerCase()) &&
          /(exist|unique|duplicate)/.test(apiData.detail.toLowerCase())) ||
        (status === 400 && /duplicate|unique/i.test(JSON.stringify(apiData)))
      ) {
        message = "Email already exists. Please use another email.";
      } else {
        // Fallback: show detail or first field error or generic
        const firstFieldError = (() => {
          try {
            const values = Object.values(apiData);
            if (!values.length) return "";
            const first = Array.isArray(values[0])
              ? values[0].join(", ")
              : String(values[0]);
            return first;
          } catch {
            return "";
          }
        })();
        message =
          apiData?.detail || firstFieldError || "Failed to create account!";
      }

      toast.error(message);
    }
  };

  // Handle sort order change
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Get sort icon for column header
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <FiArrowUp className="ml-2 text-gray-400" />;
    }
    return sortOrder === "asc" ? (
      <FiArrowUp className="ml-2 text-white" />
    ) : (
      <FiArrowDown className="ml-2 text-white" />
    );
  };

  //

  // Handle role filter change
  const handleRoleChange = (role) => {
    setFilterRole(role);
    setIsRoleDropdownOpen(false);
    setCurrentPage(1);
  };

  // Handle department filter change
  const handleDepartmentChange = (department) => {
    setFilterDepartment(department);
    setIsDepartmentDropdownOpen(false);
    setCurrentPage(1);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Format as MM/DD/YY HH:mm
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear().toString().substring(2);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${month}/${day}/${year} ${hours}:${minutes}`;
  };

  // Get unique departments from users
  const getUniqueDepartments = () => {
    const departments = user
      .map(u => u.department)
      .filter(dept => dept && dept.trim() !== "");
    return [...new Set(departments)].sort();
  };

  // Handle export to Excel
  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast.warning("No data to export!", {
        style: { backgroundColor: "orange", color: "white" },
      });
      return;
    }

    try {
      const exportData = filteredUsers.map((account, index) => ({
        No: index + 1,
        "First Name": account.first_name || "",
        "Last Name": account.last_name || "",
        "Full Name": account.full_name || "",
        Email: account.email || "",
        Department: account.department || "",
        Role: account.role || "",
        "Created Date": account.date_joined
          ? new Date(account.date_joined).toLocaleString()
          : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();

      // Set column widths
      worksheet["!cols"] = [
        { wch: 5 },  // No
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 25 }, // Full Name
        { wch: 30 }, // Email
        { wch: 20 }, // Department
        { wch: 15 }, // Role
        { wch: 20 }, // Created Date
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Accounts");

      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `accounts_${currentDate}.xlsx`;

      XLSX.writeFile(workbook, filename);

      toast.success("Excel file exported successfully!", {
        style: { backgroundColor: "green", color: "white" },
      });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Failed to export Excel file!", {
        style: { backgroundColor: "red", color: "white" },
      });
    }
  };

  // Sort and filter
  const filteredUsers = [...user]
    .filter((account) => {
      const nameMatch = account.full_name
        .toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase());
      const emailMatch = (account.email || "")
        .toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase());
      const deptMatch = (account.department || "")
        .toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase());
      const roleMatch = filterRole === "" || account.role === filterRole;
      const departmentMatch = filterDepartment === "" || account.department === filterDepartment;
      return (nameMatch || emailMatch || deptMatch) && roleMatch && departmentMatch;
    })
    .sort((a, b) => {
      const aVal = a[sortField]?.toString().toLowerCase();
      const bVal = b[sortField]?.toString().toLowerCase();
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const currentAccounts = filteredUsers.slice(
    (validPage - 1) * ITEMS_PER_PAGE,
    validPage * ITEMS_PER_PAGE
  );

  if (loading)
    return (
      <>
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div className="h-full bg-[#004098CC] animate-loading-bar"></div>
        </div>
      </>
    );

  return (
    <div className="flex flex-1 flex-col h-full gap-[0.25rem]">
      {/* Controls Frame with Search and Action Buttons */}
      <div className="bg-white p-[0.5rem] rounded-t-lg">
        <div className="flex flex-wrap justify-between items-center gap-[1rem]">
          {/* Left side - Create Account and Export Buttons */}
          <div className="flex flex-wrap items-center gap-[1rem]">
            <button
              className="flex items-center px-4 py-2 rounded-full text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              onClick={() => setIsAddingAccount(true)}
            >
              <FaPlus className="mr-2" /> Create Account
            </button>
            <button
              className="flex items-center px-4 py-2 rounded-full text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExport}
              disabled={loading || filteredUsers.length === 0}
              title="Export to Excel"
            >
              <FiDownload className="mr-2" /> Export
            </button>
          </div>

          {/* Right side - Search Control */}
          <div className="flex flex-wrap items-center gap-[1rem]">
            {/* Search Control */}
            <div className="relative w-[16rem]">
              <FiSearch className="absolute left-[0.75rem] top-[0.75rem] text-gray-500 z-10" />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="p-[0.5rem] pl-[2.5rem] border border-gray-300 rounded-full w-full bg-white text-black placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Frame with Table */}
      <div className="bg-white p-[0.5rem] rounded-b-lg flex-1 flex flex-col min-h-0">
        {/* Table section */}
        <div className="overflow-auto flex-1 min-h-0 border border-gray-200">
          <table className="w-full border-collapse bg-white rounded-lg">
            <thead>
              <tr className="bg-[#004098CC] text-white font-bold">
                <th
                  className="p-[0.5rem] border-b border-gray-300 w-[4%] text-center cursor-pointer hover:bg-[#003875] transition-colors"
                  onClick={() => handleSort("id")}
                >
                  <div className="flex items-center justify-center">
                    No
                    {getSortIcon("id")}
                  </div>
                </th>
                <th
                  className="p-[0.5rem] border-b border-gray-300 w-[28%] text-center cursor-pointer hover:bg-[#003875] transition-colors"
                  onClick={() => handleSort("full_name")}
                >
                  <div className="flex items-center justify-center">
                    Name
                    {getSortIcon("full_name")}
                  </div>
                </th>
                <th className="p-[0.5rem] border-b border-gray-300 w-[18%] text-center relative">
                  <div
                    className="flex items-center justify-center"
                    ref={departmentDropdownRef}
                  >
                    <span
                      className="cursor-pointer hover:bg-[#003875] px-3 py-1 rounded-md transition-all duration-200 flex items-center select-none"
                      onClick={() => setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen)}
                    >
                      Department
                      <FiChevronDown
                        className={`ml-2 transition-transform duration-200 ${isDepartmentDropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                    {isDepartmentDropdownOpen && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-[160px] bg-white border border-gray-300 rounded-lg shadow-lg z-30 overflow-hidden max-h-[300px] overflow-y-auto">
                        <div
                          className={`p-[0.5rem] cursor-pointer transition-colors border-b border-gray-200 font-normal ${filterDepartment === ""
                            ? "bg-[#004098CC] text-white"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                          onClick={() => handleDepartmentChange("")}
                        >
                          All Departments
                        </div>
                        {getUniqueDepartments().map((dept) => (
                          <div
                            key={dept}
                            className={`p-[0.5rem] cursor-pointer transition-colors border-b border-gray-200 font-normal ${filterDepartment === dept
                              ? "bg-[#004098CC] text-white"
                              : "text-gray-700 hover:bg-gray-50"
                              }`}
                            onClick={() => handleDepartmentChange(dept)}
                          >
                            {dept}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </th>
                <th className="p-[0.5rem] border-b border-gray-300 w-[18%] text-center relative">
                  <div
                    className="flex items-center justify-center"
                    ref={roleDropdownRef}
                  >
                    <span
                      className="cursor-pointer hover:bg-[#003875] px-3 py-1 rounded-md transition-all duration-200 flex items-center select-none"
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    >
                      Role
                      <FiChevronDown
                        className={`ml-2 transition-transform duration-200 ${isRoleDropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </span>
                    {isRoleDropdownOpen && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-[140px] bg-white border border-gray-300 rounded-lg shadow-lg z-30 overflow-hidden">
                        <div
                          className={`p-[0.5rem] cursor-pointer transition-colors border-b border-gray-200 font-normal ${filterRole === ""
                            ? "bg-[#004098CC] text-white"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                          onClick={() => handleRoleChange("")}
                        >
                          All Roles
                        </div>
                        <div
                          className={`p-[0.5rem] cursor-pointer transition-colors border-b border-gray-200 font-normal ${filterRole === "Admin"
                            ? "bg-[#004098CC] text-white"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                          onClick={() => handleRoleChange("Admin")}
                        >
                          Admin
                        </div>
                        <div
                          className={`p-[0.5rem] cursor-pointer transition-colors border-b border-gray-200 font-normal ${filterRole === "User"
                            ? "bg-[#004098CC] text-white"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                          onClick={() => handleRoleChange("User")}
                        >
                          User
                        </div>
                        <div
                          className={`p-[0.5rem] cursor-pointer transition-colors font-normal ${filterRole === "Library Keeper"
                            ? "bg-[#004098CC] text-white"
                            : "text-gray-700 hover:bg-gray-50"
                            }`}
                          onClick={() => handleRoleChange("Library Keeper")}
                        >
                          Library Keeper
                        </div>
                      </div>
                    )}
                  </div>
                </th>
                <th className="p-[0.5rem] border-b border-gray-300 w-[28%] text-center">
                  Email
                </th>
                <th
                  className="p-[0.5rem] border-b border-gray-300 w-[12%] text-center cursor-pointer hover:bg-[#003875] transition-colors"
                  onClick={() => handleSort("date_joined")}
                  title="Sort by creation time"
                >
                  <div className="flex items-center justify-center">
                    Joined
                    {getSortIcon("date_joined")}
                  </div>
                </th>
                <th className="p-[0.5rem] border-b border-gray-300 w-[15%] text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {currentAccounts.map((account, index) => (
                <tr
                  key={account.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                    }`}
                >
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[4%]">
                    {(validPage - 1) * ITEMS_PER_PAGE + index + 1}
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[28%]">
                    <div className="flex items-center space-x-[0.5rem] justify-center">
                      <span>{account.full_name}</span>
                    </div>
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[18%]">
                    <span className="text-gray-700">
                      {account.department || "N/A"}
                    </span>
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[18%]">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                      {account.role}
                    </span>
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[28%]">
                    {account.email}
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[12%]">
                    <span className="text-xs text-gray-600" title={account.date_joined}>
                      {formatDate(account.date_joined)}
                    </span>
                  </td>
                  <td className="p-[0.75rem] border-b border-gray-200 text-center w-[15%]">
                    <div className="flex justify-center space-x-[1rem]">
                      <button
                        onClick={() => {
                          setSelectedUserId(account.id);
                          setIsEditRoleModalOpen(true);
                        }}
                        className="p-[0.5rem] bg-blue-100 rounded-md hover:bg-blue-200 flex items-center justify-center transition-colors"
                        title="Edit Role"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-blue-600 w-[1.25rem] h-[1.25rem]"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="p-[0.5rem] bg-red-100 rounded-md hover:bg-red-200 flex items-center justify-center transition-colors"
                        title="Delete Account"
                        onClick={() => handleDelete(account.id)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-red-600 w-[1.25rem] h-[1.25rem]"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={validPage}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)))}
        />
      </div>

      {/* Modal for creating account */}
      {isAddingAccount && (
        <CreateAccountModal
          newAccount={newAccount}
          onFieldChange={setNewAccount}
          onSubmit={handleAddAccount}
          onClose={() => setIsAddingAccount(false)}
        />
      )}

      {/* Add EditUserRole modal */}
      <EditUserRole
        isOpen={isEditRoleModalOpen}
        onClose={() => {
          setIsEditRoleModalOpen(false);
          setSelectedUserId(null);
        }}
        userId={selectedUserId}
        onUserUpdated={fetchUsers}
      />


    </div>
  );
}

export default AccountManagement;

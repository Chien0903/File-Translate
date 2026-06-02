import PropTypes from "prop-types";

const CreateAccountModal = ({
    newAccount,
    onFieldChange,
    onSubmit,
    onClose,
}) => {
    return (
        <div
            className="fixed inset-0 flex justify-center items-center z-50 bg-black/20 backdrop-blur-[1px]"
            onClick={onClose}
        >
            <div
                className="bg-white p-8 rounded-2xl shadow-2xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-[#004098] mb-2">
                        Create New Account
                    </h3>
                    <p className="text-gray-600 text-sm">
                        Fill in the details to create a new user account
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-gray-700 text-sm font-semibold">
                                First Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={newAccount.firstName}
                                    onChange={(e) =>
                                        onFieldChange({
                                            ...newAccount,
                                            firstName: e.target.value,
                                        })
                                    }
                                    className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#004098] focus:ring-2 focus:ring-[#004098]/20 transition-all duration-200"
                                    placeholder="Enter first name"
                                    required
                                />
                                <svg
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-gray-700 text-sm font-semibold">
                                Last Name <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={newAccount.lastName}
                                    onChange={(e) =>
                                        onFieldChange({
                                            ...newAccount,
                                            lastName: e.target.value,
                                        })
                                    }
                                    className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#004098] focus:ring-2 focus:ring-[#004098]/20 transition-all duration-200"
                                    placeholder="Enter last name"
                                    required
                                />
                                <svg
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="space-y-2">
                        <label className="block text-gray-700 text-sm font-semibold">
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                value={newAccount.email}
                                onChange={(e) =>
                                    onFieldChange({ ...newAccount, email: e.target.value })
                                }
                                className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#004098] focus:ring-2 focus:ring-[#004098]/20 transition-all duration-200"
                                placeholder="example@mail.com"
                                required
                            />
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Department Field */}
                    <div className="space-y-2">
                        <label className="block text-gray-700 text-sm font-semibold">
                            Department <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={newAccount.department}
                                onChange={(e) =>
                                    onFieldChange({
                                        ...newAccount,
                                        department: e.target.value,
                                    })
                                }
                                className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#004098] focus:ring-2 focus:ring-[#004098]/20 transition-all duration-200"
                                placeholder="Enter department"
                                required
                            />
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422A12.083 12.083 0 0112 21.5 12.083 12.083 0 015.84 10.578L12 14z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Role Field */}
                    <div className="space-y-2">
                        <label className="block text-gray-700 text-sm font-semibold">
                            Account Role <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={newAccount.role}
                                onChange={(e) =>
                                    onFieldChange({ ...newAccount, role: e.target.value })
                                }
                                className="w-full p-3 pl-10 pr-10 border-2 border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#004098] focus:ring-2 focus:ring-[#004098]/20 transition-all duration-200 appearance-none"
                                required
                            >
                                <option value="User">User</option>
                                <option value="Admin">Admin</option>
                                <option value="Library Keeper">Library Keeper</option>
                            </select>
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <svg
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 pt-6">
                        <button
                            type="button"
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-all duration-200 border border-gray-300"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-3 bg-gradient-to-r from-[#004098] to-[#0477BF] text-white rounded-lg hover:from-[#003875] hover:to-[#035a9e] font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            Create Account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

CreateAccountModal.propTypes = {
    newAccount: PropTypes.object.isRequired,
    onFieldChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default CreateAccountModal;

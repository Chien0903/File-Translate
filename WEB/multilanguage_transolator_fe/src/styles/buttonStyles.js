export const buttonStyles = {
  primary: "bg-indigo-700 text-white px-6 py-2.5 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center",
  primaryFixed: "bg-indigo-700 text-white px-6 py-2.5 w-48 h-10 rounded-full shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center",
  secondary: "bg-indigo-50 border border-indigo-600 text-indigo-700 px-6 py-2 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center",
  secondaryFixed: "bg-indigo-50 border border-indigo-600 text-indigo-700 px-6 py-2 w-48 h-10 rounded-full shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center",
  success: "bg-green-500 text-white px-6 py-2.5 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-green-600 transition-colors duration-200 flex items-center justify-center",
  danger: "bg-red-500 text-white px-6 py-2.5 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-red-600 transition-colors duration-200 flex items-center justify-center",
  warning: "bg-orange-500 text-white px-6 py-2.5 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-orange-600 transition-colors duration-200 flex items-center justify-center",
  info: "bg-blue-500 text-white px-6 py-2.5 h-10 min-w-[100px] rounded-full shadow-sm hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center",
  icon: "w-8 h-8 bg-indigo-700 text-white rounded-full shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center",
  iconSecondary: "w-8 h-8 bg-indigo-50 border border-indigo-600 text-indigo-700 rounded-full shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center",
  languageActive: "bg-indigo-700 text-white border border-indigo-700 px-6 py-2 w-48 h-10 rounded-full shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center whitespace-nowrap",
  languageInactive: "bg-indigo-50 text-indigo-700 border border-indigo-600 px-6 py-2 w-48 h-10 rounded-full shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center whitespace-nowrap",
  browse: "bg-indigo-700 text-white text-sm px-6 py-2 h-10 min-w-[80px] rounded-full cursor-pointer shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center",
  primaryCompact: "bg-indigo-700 text-white px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-indigo-800 transition-colors duration-200 flex items-center justify-center text-sm",
  secondaryCompact: "bg-indigo-50 border border-indigo-600 text-indigo-700 px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center text-sm",
  successCompact: "bg-green-500 text-white px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-green-600 transition-colors duration-200 flex items-center justify-center text-sm",
  dangerCompact: "bg-red-500 text-white px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-red-600 transition-colors duration-200 flex items-center justify-center text-sm",
  warningCompact: "bg-orange-500 text-white px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-orange-600 transition-colors duration-200 flex items-center justify-center text-sm",
  infoCompact: "bg-blue-500 text-white px-3 py-1.5 h-8 min-w-[80px] rounded-full shadow-sm hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center text-sm",
};

export const mergeButtonStyles = (baseStyle, customClasses = "") => `${baseStyle} ${customClasses}`.trim();

import React from "react";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Sliding window: current page always centered, 1 page on each side
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Near start: current <= 2 → [1, 2, 3, ..., last]
    if (currentPage <= 2) {
      return [1, 2, 3, '...', totalPages];
    }

    // Near end: current >= last-1 → [1, ..., last-2, last-1, last]
    if (currentPage >= totalPages - 1) {
      return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    }

    // Middle: [1, ..., prev, current, next, (... if gap), last]
    const pages = [1, '...', currentPage - 1, currentPage, currentPage + 1];
    if (currentPage + 2 < totalPages) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center py-4 h-min">
      {/* Previous page button */}
      <button
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
        className="w-10 h-10 flex items-center justify-center text-gray-600 border border-[#D6D6D6] rounded-md mr-1 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
        title="Trang trước"
      >
        &lsaquo;
      </button>
      
      {/* Page numbers and ellipsis */}
      {getPageNumbers().map((page, index) => (
        page === '...' ? (
          <span
            key={`ellipsis-${index}`}
            className="w-10 h-10 flex items-center justify-center text-gray-600 mx-1"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 mx-1 rounded-md ${
              currentPage === page 
                ? 'bg-[#004098] text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {page}
          </button>
        )
      ))}
      
      {/* Next page button */}
      <button
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className="w-10 h-10 flex items-center justify-center text-gray-600 border border-[#D6D6D6] rounded-md ml-1 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
        title="Trang sau"
      >
        &rsaquo;
      </button>
    </div>
  );
};

export default Pagination;

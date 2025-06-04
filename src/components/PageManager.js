import React from 'react';

const PageManager = ({ currentPage, totalPages, onPageChange, onAddPage }) => {
  return (
    <>
      {/* Previous Page */}
      <button
        className={`page-btn ${currentPage === 0 ? 'disabled' : ''}`}
        onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        title="Previous Page"
      >
        ◀️
      </button>

      {/* Page Indicator */}
      <div className="page-indicator" title={`Page ${currentPage + 1} of ${totalPages}`}>
        <span>{currentPage + 1}</span>
        <div className="page-separator">/</div>
        <span>{totalPages}</span>
      </div>

      {/* Next Page */}
      <button
        className={`page-btn ${currentPage === totalPages - 1 ? 'disabled' : ''}`}
        onClick={() => currentPage < totalPages - 1 && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        title="Next Page"
      >
        ▶️
      </button>

      {/* Add Page */}
      <button
        className="page-btn add-page"
        onClick={onAddPage}
        title="Add New Page"
      >
        ➕
      </button>
    </>
  );
};

export default PageManager; 
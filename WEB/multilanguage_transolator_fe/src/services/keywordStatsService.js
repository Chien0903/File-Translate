import userService from "./userService";

export const keywordStatsService = {
  getKeywordStats: async (startDate, endDate) => {
    try {
      const token = localStorage.getItem("access");
      const response = await userService.getKeywordStats(startDate, endDate, token);
      return response.data;
    } catch (error) {
      console.error("Error fetching keyword stats:", error);
      throw error;
    }
  },

  // Export data to CSV
  exportToCSV: (data, filename = "keyword-stats.csv") => {
    const headers = [
      "No.",
      "Username",
      "Email",
      "Department",
      "Suggestions",
      "Approved",
      "Rejected",
      "Approval Rate (%)",
      "Last Suggestion Date",
    ];

    const csvContent = [
      headers.join(","),
      ...data.map((row, index) =>
        [
          index + 1,
          row.username,
          row.email,
          row.department || "N/A",
          row.suggestions,
          row.approved,
          row.rejected,
          row.approvalRate,
          new Date(row.lastSuggestionDate).toLocaleDateString("vi-VN"),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

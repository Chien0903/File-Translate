import { useState, useEffect, useRef } from "react";
import { IoMdNotifications } from "react-icons/io";
import ReactDOM from "react-dom";
import notificationService from "../../services/notificationService";
import { ICON_SIZES } from "../../constants/constants";

// Helper function to check if two dates are within the specified minutes of each other
const isWithinTimeframe = (date1, date2, minutes = 30) => {
  const timeDifference = Math.abs(new Date(date1) - new Date(date2));
  const minuteDifference = timeDifference / (1000 * 60);
  return minuteDifference <= minutes;
};

// Group notifications by time periods
const groupNotificationsByTime = (notifications) => {
  if (!notifications.length) return [];

  // Sort by creation date (newest first)
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  const groups = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    // Compare with the first item in current group (newest in group)
    if (isWithinTimeframe(sorted[i].created_at, currentGroup[0].created_at)) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [sorted[i]];
    }
  }

  // Don't forget the last group
  if (currentGroup.length) {
    groups.push(currentGroup);
  }

  return groups;
};

const Notifications = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const notificationBtnRef = useRef(null);
  const [notificationPosition, setNotificationPosition] = useState({
    top: 0,
    right: 0,
  });

  useEffect(() => {
    // Fetch notifications on load and every 30 seconds
    fetchNotifications();
    const notificationInterval = setInterval(fetchNotifications, 30000);

    return () => {
      clearInterval(notificationInterval);
    };
  }, []);

  // When user opens the notification dropdown, mark all as read and clear badge count
  useEffect(() => {
    if (showNotifications && unreadCount > 0) {
      markAllAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  useEffect(() => {
    const updatePosition = () => {
      if (notificationBtnRef.current) {
        const rect = notificationBtnRef.current.getBoundingClientRect();
        setNotificationPosition({
          top: rect.bottom + window.scrollY + 10, // 10px below the button
          right: window.innerWidth - rect.right, // Align with the right edge of the button
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [showNotifications]);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications || showDetailPopup) {
        const target = event.target;
        if (
          !target.closest(".notification-menu") &&
          !target.closest(".keyword-details-popup")
        ) {
          setShowNotifications(false);
          if (!target.closest(".keyword-details-button")) {
            setShowDetailPopup(false);
          }
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showNotifications, showDetailPopup]);

  const fetchNotifications = async () => {
    try {
      // Replace with your actual API endpoint for notifications
      const response = await notificationService.getNotifications();

      // Sort notifications by date (newest first)
      const sortedNotifications = response.data.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      // Process keyword-related notifications separately by action type
      const groupedNotifications = [];

      // Find all keyword-related notifications
      const keywordNotifications = sortedNotifications.filter(
        (n) =>
          n.type === "keyword_update" ||
          n.title?.includes("Keyword") ||
          n.message?.includes("keyword") ||
          n.message?.includes("library")
      );

      // Separate by action type first
      const updatedNotifications = keywordNotifications.filter(
        (n) =>
          n.title === "Keyword Updated" ||
          (n.keyword_details &&
            n.keyword_details.some((k) => k.action === "updated"))
      );

      const deletedNotifications = keywordNotifications.filter(
        (n) =>
          n.title === "Keyword Deleted" ||
          (n.keyword_details &&
            n.keyword_details.some((k) => k.action === "deleted"))
      );

      const addedNotifications = keywordNotifications.filter(
        (n) =>
          n.title === "New Keyword Added" ||
          n.title?.includes("New Keyword") ||
          (n.keyword_details &&
            n.keyword_details.some((k) => k.action === "added" || !k.action))
      );

      // Group each type separately by time period
      const updatedTimeGroups = groupNotificationsByTime(updatedNotifications);
      const deletedTimeGroups = groupNotificationsByTime(deletedNotifications);
      const addedTimeGroups = groupNotificationsByTime(addedNotifications);

      // Create consolidated notifications for updated keywords
      updatedTimeGroups.forEach((group) => {
        if (group.length === 0) return;

        const latestDate = group[0].created_at;
        const allKeywordDetails = group.flatMap((n) => n.keyword_details || []);
        const isAllRead = group.every((n) => n.read);

        const consolidatedNotification = {
          id: "consolidated-updated-" + Date.now() + "-" + group[0].id,
          title: "Keywords Updated",
          message: `${allKeywordDetails.length} keyword${
            allKeywordDetails.length > 1 ? "s have" : " has"
          } been updated`,
          created_at: latestDate,
          read: isAllRead,
          details: true,
          type: "keyword_update",
          action_type: "updated",
          keyword_details: allKeywordDetails,
          original_notifications: group,
        };

        groupedNotifications.push(consolidatedNotification);
      });

      // Create consolidated notifications for deleted keywords
      deletedTimeGroups.forEach((group) => {
        if (group.length === 0) return;

        const latestDate = group[0].created_at;
        const allKeywordDetails = group.flatMap((n) => n.keyword_details || []);
        const isAllRead = group.every((n) => n.read);

        const consolidatedNotification = {
          id: "consolidated-deleted-" + Date.now() + "-" + group[0].id,
          title: "Keywords Deleted",
          message: `${allKeywordDetails.length} keyword${
            allKeywordDetails.length > 1 ? "s have" : " has"
          } been removed from the library`,
          created_at: latestDate,
          read: isAllRead,
          details: true,
          type: "keyword_update",
          action_type: "deleted",
          keyword_details: allKeywordDetails,
          original_notifications: group,
        };

        groupedNotifications.push(consolidatedNotification);
      });

      // Create consolidated notifications for added keywords
      addedTimeGroups.forEach((group) => {
        if (group.length === 0) return;

        const latestDate = group[0].created_at;
        const allKeywordDetails = group.flatMap((n) => n.keyword_details || []);
        const isAllRead = group.every((n) => n.read);

        const consolidatedNotification = {
          id: "consolidated-added-" + Date.now() + "-" + group[0].id,
          title: "New Keywords Added",
          message: `${allKeywordDetails.length} new keyword${
            allKeywordDetails.length > 1 ? "s have" : " has"
          } been added to the library`,
          created_at: latestDate,
          read: isAllRead,
          details: true,
          type: "keyword_update",
          action_type: "added",
          keyword_details: allKeywordDetails,
          original_notifications: group,
        };

        groupedNotifications.push(consolidatedNotification);
      });

      // Add other non-keyword notifications
      const otherNotifications = sortedNotifications.filter(
        (n) =>
          !(
            n.type === "keyword_update" ||
            n.title?.includes("Keyword") ||
            n.message?.includes("keyword") ||
            n.message?.includes("library")
          )
      );

      groupedNotifications.push(...otherNotifications);

      setNotifications(groupedNotifications);

      // Count unread notifications
      const unread = groupedNotifications.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      // If it's a consolidated notification, mark all original notifications as read
      const notification = notifications.find((n) => n.id === notificationId);

      if (notification && notification.original_notifications) {
        // Mark all original keyword notifications as read
        for (const originalNotification of notification.original_notifications) {
          if (!originalNotification.read) {
            await notificationService.markAsRead(originalNotification.id);
          }
        }

        // Update local state
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
      } else {
        // Standard single notification
        await notificationService.markAsRead(notificationId);

        // Update local state to mark as read
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
      }

      // Update unread count
      if (notification && notification.original_notifications) {
        const unreadInGroup = notification.original_notifications.filter(
          (n) => !n.read
        ).length;
        setUnreadCount((prev) => Math.max(0, prev - unreadInGroup));
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const requests = [];
      notifications.forEach((n) => {
        if (
          n.original_notifications &&
          Array.isArray(n.original_notifications)
        ) {
          n.original_notifications.forEach((orig) => {
            if (!orig.read) {
              requests.push(notificationService.markAsRead(orig.id));
            }
          });
        } else if (!n.read) {
          requests.push(notificationService.markAsRead(n.id));
        }
      });

      if (requests.length > 0) {
        await Promise.allSettled(requests);
      }

      // Set all as read locally and clear the badge
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const ensureKeywordUpdateTimes = (notification) => {
    if (!notification || !notification.keyword_details) return notification;

    // Deep clone to avoid mutating the original
    const updatedNotification = { ...notification };

    // Make sure each keyword has an update time
    updatedNotification.keyword_details = notification.keyword_details.map(
      (keyword) => {
        // If the keyword doesn't have an update time, try to find it from its original notification
        if (!keyword.updated_at && notification.original_notifications) {
          const matchingNotification = notification.original_notifications.find(
            (n) =>
              n.keyword_details?.some(
                (k) =>
                  k.japanese === keyword.japanese &&
                  k.english === keyword.english
              )
          );

          if (matchingNotification) {
            return {
              ...keyword,
              updated_at: matchingNotification.created_at,
            };
          }
        }

        return keyword;
      }
    );

    return updatedNotification;
  };

  const handleShowDetails = (notification) => {
    setSelectedNotification(ensureKeywordUpdateTimes(notification));
    setShowDetailPopup(true);
  };

  // Use portal to render notifications outside of the component hierarchy
  const NotificationPortal = ({ children }) => {
    const portalRoot = document.getElementById("root") || document.body;
    const element = document.createElement("div");
    element.style.position = "fixed";
    element.style.top = "0";
    element.style.left = "0";
    element.style.width = "100%";
    element.style.height = "100%";
    // Adjust z-index based on whether details popup is showing
    element.style.zIndex = showDetailPopup ? "2147483646" : "2147483647"; // Lower z-index when details popup is shown
    element.style.pointerEvents = "none";

    useEffect(() => {
      document.body.classList.add("overflow-hidden");
      portalRoot.appendChild(element);
      return () => {
        document.body.classList.remove("overflow-hidden");
        portalRoot.removeChild(element);
      };
    }, [element, portalRoot]);

    return ReactDOM.createPortal(
      <div
        style={{
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        {children}
      </div>,
      element
    );
  };

  // Portal for the details popup with improved z-index and backdrop
  const PopupPortal = ({ children }) => {
    const portalRoot = document.getElementById("root") || document.body;
    const element = document.createElement("div");
    element.style.position = "fixed";
    element.style.top = "0";
    element.style.left = "0";
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.zIndex = "2147483647"; // Always use highest possible z-index
    element.style.display = "flex";
    element.style.justifyContent = "center";
    element.style.alignItems = "center";
    element.style.backgroundColor = "rgba(0, 0, 0, 0.6)"; // Darker backdrop
    // Add slight animation for better visual hierarchy
    element.style.animation = "fadeIn 0.2s ease-out";

    useEffect(() => {
      document.body.classList.add("overflow-hidden");
      portalRoot.appendChild(element);
      return () => {
        document.body.classList.remove("overflow-hidden");
        portalRoot.removeChild(element);
      };
    }, [element, portalRoot]);

    return ReactDOM.createPortal(children, element);
  };

  return (
    <>
      <div
        ref={notificationBtnRef}
        className="notification-menu relative inline-flex items-center cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setShowNotifications(!showNotifications);
        }}
        style={{ zIndex: "100" }}
      >
        <div className="relative">
          <IoMdNotifications
            size={ICON_SIZES.INTERFACE_LARGE}
            className="text-gray-600 hover:text-gray-900"
          />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Notification Dropdown - Using Portal */}
        {showNotifications && (
          <NotificationPortal>
            <div
              style={{
                position: "absolute",
                top: `${notificationPosition.top}px`,
                right: `${notificationPosition.right}px`,
                width: "320px",
                maxWidth: "calc(100vw - 24px)",
                pointerEvents: "auto",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
                borderRadius: "16px",
                background: "white",
                animation: "fadeIn 0.2s ease-out",
              }}
              className="bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden"
            >
              <div className="p-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No notifications
                  </div>
                ) : (
                  <ul className="flex flex-col">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${
                          !notification.read ? "bg-blue-50" : ""
                        }`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            {notification.action_type === "updated" && (
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            )}
                            {notification.action_type === "deleted" && (
                              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            )}
                            {notification.action_type === "added" && (
                              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            )}
                            <span className="font-medium text-sm">
                              {notification.title}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        {(notification.details ||
                          notification.keyword_details) && (
                          <div className="mt-2">
                            <button
                              className="keyword-details-button text-xs text-blue-600 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowDetails(notification);
                              }}
                            >
                              Show Details
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </NotificationPortal>
        )}
      </div>

      {/* Keyword Details Popup - Using Portal with improved layering */}
      {showDetailPopup && selectedNotification && (
        <PopupPortal>
          <div
            className="keyword-details-popup bg-white p-6 rounded-lg shadow-xl max-w-5xl w-11/12 max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "fadeInScale 0.3s ease-out",
              boxShadow:
                "0 16px 32px rgba(0, 0, 0, 0.25), 0 8px 16px rgba(0, 0, 0, 0.2)",
              transform: "translateY(0)",
              opacity: 1,
              position: "relative",
              zIndex: 2147483647,
            }}
          >
            <div className="flex justify-center items-center mb-4">
              <h3 className="text-lg text-[#004098CC] font-bold">
                {selectedNotification.action_type === "updated"
                  ? "KEYWORDS UPDATED"
                  : selectedNotification.action_type === "deleted"
                  ? "KEYWORDS DELETED"
                  : selectedNotification.action_type === "added"
                  ? "NEW KEYWORDS ADDED"
                  : "KEYWORD UPDATE DETAILS"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white overflow-hidden">
                <thead>
                  <tr className="bg-[#004098CC] text-white font-bold">
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[5%]">
                      No
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[12%]">
                      Japanese
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[12%]">
                      English
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[12%]">
                      Vietnamese
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[12%]">
                      Chinese (Traditional)
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[12%]">
                      Chinese (Simplified)
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[10%]">
                      Action
                    </th>
                    <th className="p-[0.75rem] border-b border-gray-300 text-center w-[15%]">
                      {selectedNotification.action_type === "deleted"
                        ? "Deleted Time"
                        : selectedNotification.action_type === "updated"
                        ? "Updated Time"
                        : selectedNotification.action_type === "added"
                        ? "Added Time"
                        : "Update Time"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedNotification.keyword_details?.map(
                    (keyword, index) => (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                          index % 2 === 0 ? "bg-white" : "bg-[#F8F8F8]"
                        }`}
                      >
                        <td className="p-[0.75rem] border-b border-gray-200 text-center">
                          {index + 1}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center truncate max-w-[150px]">
                          {keyword.japanese || ""}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center truncate max-w-[150px]">
                          {keyword.english || ""}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center truncate max-w-[150px]">
                          {keyword.vietnamese || ""}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center truncate max-w-[150px]">
                          {keyword.chinese_traditional || ""}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center truncate max-w-[150px]">
                          {keyword.chinese_simplified || ""}
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              (keyword.action ||
                                selectedNotification.action_type) === "updated"
                                ? "bg-blue-100 text-blue-800"
                                : (keyword.action ||
                                    selectedNotification.action_type) ===
                                  "deleted"
                                ? "bg-red-100 text-red-800"
                                : (keyword.action ||
                                    selectedNotification.action_type) ===
                                  "added"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {(
                              keyword.action ||
                              selectedNotification.action_type ||
                              "updated"
                            ).toUpperCase()}
                          </span>
                        </td>
                        <td className="p-[0.75rem] border-b border-gray-200 text-center text-sm truncate">
                          {formatDate(
                            keyword.updated_at ||
                              keyword.deleted_at ||
                              keyword.added_at ||
                              selectedNotification.created_at
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PopupPortal>
      )}

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default Notifications;

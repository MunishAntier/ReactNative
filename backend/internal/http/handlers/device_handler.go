package handlers

import (
	"net/http"
	"strconv"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/http/middleware"

	"github.com/gin-gonic/gin"
)

// ListUserDevices returns all active devices + key bundles for a target user (Rule 1, 20).
// GET /users/:user_id/devices
func (h *Handler) ListUserDevices(c *gin.Context) {
	targetUserID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || targetUserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	callerUserID := middleware.CurrentUserID(c)
	now := time.Now().UTC()

	devices, err := h.Store.ListActiveDevicesWithKeys(c.Request.Context(), targetUserID, now)
	if err != nil {
		h.audit(c, "devices.list.failed", int64Ptr(callerUserID), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"target_user_id": targetUserID,
			"error":          err.Error(),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if devices == nil {
		devices = make([]domain.DeviceWithKeys, 0)
	}
	h.audit(c, "devices.list.succeeded", int64Ptr(callerUserID), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
		"target_user_id": targetUserID,
		"device_count":   len(devices),
	})
	c.JSON(http.StatusOK, gin.H{"devices": devices})
}

// ListMyDevices returns the current user's active devices.
// GET /devices/me
func (h *Handler) ListMyDevices(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	devices, err := h.Store.ListMyActiveDevices(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if devices == nil {
		devices = make([]domain.Device, 0)
	}
	c.JSON(http.StatusOK, gin.H{"devices": devices})
}

// UnlinkDevice deactivates a device and removes its keys/sessions (Rule 13).
// DELETE /devices/:device_id
func (h *Handler) UnlinkDevice(c *gin.Context) {
	deviceID, err := strconv.ParseInt(c.Param("device_id"), 10, 64)
	if err != nil || deviceID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device_id"})
		return
	}
	userID := middleware.CurrentUserID(c)
	callerDeviceID := middleware.CurrentDeviceID(c)
	now := time.Now().UTC()

	// Verify device belongs to the user (Rule 48)
	device, err := h.Store.GetDeviceByID(c.Request.Context(), deviceID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if device == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}
	if !device.IsActive {
		c.JSON(http.StatusConflict, gin.H{"error": "device already unlinked"})
		return
	}
	// Cannot unlink your current device via this endpoint
	if deviceID == callerDeviceID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot unlink your current device; use logout instead"})
		return
	}

	if err := h.Store.DeactivateDevice(c.Request.Context(), deviceID, now); err != nil {
		h.audit(c, "devices.unlink.failed", int64Ptr(userID), int64Ptr(callerDeviceID), gin.H{
			"target_device_id": deviceID,
			"error":            err.Error(),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.audit(c, "devices.unlink.succeeded", int64Ptr(userID), int64Ptr(callerDeviceID), gin.H{
		"target_device_id": deviceID,
	})
	c.JSON(http.StatusOK, gin.H{"status": "device_unlinked", "device_id": deviceID})
}

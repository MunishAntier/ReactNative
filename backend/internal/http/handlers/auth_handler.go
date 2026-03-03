package handlers

import (
	"errors"
	"net/http"

	"securemsg/backend/internal/http/middleware"
	"securemsg/backend/internal/security"
	"securemsg/backend/internal/service"

	"github.com/gin-gonic/gin"
)

type authStartRequest struct {
	Identifier        string `json:"identifier" binding:"required"`
	Purpose           string `json:"purpose"`
	DeviceFingerprint string `json:"device_fingerprint"`
}

type authVerifyRequest struct {
	Identifier string  `json:"identifier" binding:"required"`
	OTP        string  `json:"otp" binding:"required"`
	DeviceUUID string  `json:"device_uuid" binding:"required"`
	Platform   string  `json:"platform" binding:"required"`
	PushToken  *string `json:"push_token"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handler) AuthStart(c *gin.Context) {
	var req authStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "auth.otp.start.invalid_request", nil, nil, gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Purpose == "" {
		req.Purpose = "login"
	}
	resp, err := h.Auth.StartAuth(c.Request.Context(), req.Identifier, req.Purpose, c.ClientIP(), req.DeviceFingerprint)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrOTPRateLimited) {
			status = http.StatusTooManyRequests
		}
		h.audit(c, "auth.otp.start.failed", nil, nil, gin.H{
			"identifier_hash": security.SHA256Hex(req.Identifier),
			"purpose":         req.Purpose,
			"status":          status,
			"error":           err.Error(),
			"request_id":      middleware.CurrentRequestID(c),
		})
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "auth.otp.start.succeeded", nil, nil, gin.H{
		"identifier_hash": security.SHA256Hex(req.Identifier),
		"purpose":         req.Purpose,
		"request_id":      middleware.CurrentRequestID(c),
	})
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AuthVerify(c *gin.Context) {
	var req authVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "auth.otp.verify.invalid_request", nil, nil, gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.Auth.VerifyAuth(c.Request.Context(), service.VerifyAuthInput{
		Identifier: req.Identifier,
		OTP:        req.OTP,
		DeviceUUID: req.DeviceUUID,
		Platform:   req.Platform,
		PushToken:  req.PushToken,
	})
	if err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, service.ErrOTPRateLimited) {
			status = http.StatusTooManyRequests
		} else if errors.Is(err, service.ErrOTPInvalid) || errors.Is(err, service.ErrOTPNotFound) || errors.Is(err, service.ErrOTPAttemptsLimit) {
			status = http.StatusUnauthorized
		} else {
			status = http.StatusBadRequest
		}
		h.audit(c, "auth.otp.verify.failed", nil, nil, gin.H{
			"identifier_hash": security.SHA256Hex(req.Identifier),
			"status":          status,
			"error":           err.Error(),
			"request_id":      middleware.CurrentRequestID(c),
		})
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "auth.otp.verify.succeeded", int64Ptr(resp.UserID), int64Ptr(resp.DeviceID), gin.H{
		"identifier_hash": security.SHA256Hex(req.Identifier),
		"session_id":      resp.SessionID,
		"request_id":      middleware.CurrentRequestID(c),
	})
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AuthRefresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "auth.refresh.invalid_request", nil, nil, gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.Auth.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, service.ErrRefreshReuse) {
			status = http.StatusForbidden
		}
		h.audit(c, "auth.refresh.failed", nil, nil, gin.H{
			"status":     status,
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "auth.refresh.succeeded", int64Ptr(resp.UserID), int64Ptr(resp.DeviceID), gin.H{
		"session_id": resp.SessionID,
		"request_id": middleware.CurrentRequestID(c),
	})
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AuthLogout(c *gin.Context) {
	sessionID := middleware.CurrentSessionID(c)
	userID := middleware.CurrentUserID(c)
	deviceID := middleware.CurrentDeviceID(c)
	if err := h.Auth.Logout(c.Request.Context(), sessionID); err != nil {
		h.audit(c, "auth.logout.failed", int64Ptr(userID), int64Ptr(deviceID), gin.H{
			"session_id": sessionID,
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "auth.logout.succeeded", int64Ptr(userID), int64Ptr(deviceID), gin.H{
		"session_id": sessionID,
		"request_id": middleware.CurrentRequestID(c),
	})
	c.Status(http.StatusNoContent)
}

func (h *Handler) Me(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	user, err := h.Auth.Me(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/http/middleware"

	"github.com/gin-gonic/gin"
)

type prekeyInput struct {
	PreKeyID     int64  `json:"prekey_id" binding:"required"`
	PreKeyPublic string `json:"prekey_public" binding:"required"`
}

type uploadKeysRequest struct {
	RegistrationID        int           `json:"registration_id"`
	IdentityPublicKey     string        `json:"identity_public_key" binding:"required"`
	IdentityKeyVersion    int           `json:"identity_key_version"`
	SignedPreKeyID        int64         `json:"signed_prekey_id" binding:"required"`
	SignedPreKeyPublic    string        `json:"signed_prekey_public" binding:"required"`
	SignedPreKeySignature string        `json:"signed_prekey_signature" binding:"required"`
	SignedPreKeyExpiresAt string        `json:"signed_prekey_expires_at" binding:"required"`
	OneTimePreKeys        []prekeyInput `json:"one_time_prekeys" binding:"required"`
}

type rotateSignedPrekeyRequest struct {
	SignedPreKeyID        int64  `json:"signed_prekey_id" binding:"required"`
	SignedPreKeyPublic    string `json:"signed_prekey_public" binding:"required"`
	SignedPreKeySignature string `json:"signed_prekey_signature" binding:"required"`
	SignedPreKeyExpiresAt string `json:"signed_prekey_expires_at" binding:"required"`
}

type uploadPrekeysRequest struct {
	OneTimePreKeys []prekeyInput `json:"one_time_prekeys" binding:"required"`
}

func (h *Handler) UploadKeys(c *gin.Context) {
	var req uploadKeysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "keys.upload.invalid_request", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	deviceID := middleware.CurrentDeviceID(c)
	expiresAt, err := time.Parse(time.RFC3339, req.SignedPreKeyExpiresAt)
	if err != nil {
		h.audit(c, "keys.upload.invalid_expiry", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "signed_prekey_expires_at must be RFC3339"})
		return
	}
	identityVersion := req.IdentityKeyVersion
	if identityVersion <= 0 {
		identityVersion = 1
	}
	registrationID := req.RegistrationID
	if registrationID <= 0 {
		registrationID = 1
	}
	prekeys := make([]domain.OneTimePreKey, 0, len(req.OneTimePreKeys))
	for _, p := range req.OneTimePreKeys {
		prekeys = append(prekeys, domain.OneTimePreKey{DeviceID: deviceID, PreKeyID: p.PreKeyID, PreKeyPub: p.PreKeyPublic})
	}
	err = h.Keys.UploadInitialKeys(c.Request.Context(), domain.DeviceKey{
		DeviceID:            deviceID,
		RegistrationID:      registrationID,
		IdentityPublicKey:   req.IdentityPublicKey,
		IdentityKeyVersion:  identityVersion,
		SignedPreKeyID:      req.SignedPreKeyID,
		SignedPreKeyPublic:  req.SignedPreKeyPublic,
		SignedPreKeySig:     req.SignedPreKeySignature,
		SignedPreKeyExpires: expiresAt,
	}, prekeys)
	if err != nil {
		h.audit(c, "keys.upload.failed", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "keys.upload.succeeded", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
		"registration_id":      registrationID,
		"identity_key_version": identityVersion,
		"prekeys_uploaded":     len(req.OneTimePreKeys),
		"request_id":           middleware.CurrentRequestID(c),
	})
	c.Status(http.StatusCreated)
}

func (h *Handler) RotateSignedPrekey(c *gin.Context) {
	var req rotateSignedPrekeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "keys.signed_prekey.rotate.invalid_request", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	deviceID := middleware.CurrentDeviceID(c)
	expiresAt, err := time.Parse(time.RFC3339, req.SignedPreKeyExpiresAt)
	if err != nil {
		h.audit(c, "keys.signed_prekey.rotate.invalid_expiry", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "signed_prekey_expires_at must be RFC3339"})
		return
	}
	if err := h.Keys.RotateSignedPreKey(c.Request.Context(), deviceID, req.SignedPreKeyID, req.SignedPreKeyPublic, req.SignedPreKeySignature, expiresAt); err != nil {
		h.audit(c, "keys.signed_prekey.rotate.failed", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "keys.signed_prekey.rotate.succeeded", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
		"signed_prekey_id": req.SignedPreKeyID,
		"request_id":       middleware.CurrentRequestID(c),
	})
	c.Status(http.StatusNoContent)
}

func (h *Handler) UploadOneTimePrekeys(c *gin.Context) {
	var req uploadPrekeysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.audit(c, "keys.prekeys.upload.invalid_request", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	deviceID := middleware.CurrentDeviceID(c)
	prekeys := make([]domain.OneTimePreKey, 0, len(req.OneTimePreKeys))
	for _, p := range req.OneTimePreKeys {
		prekeys = append(prekeys, domain.OneTimePreKey{DeviceID: deviceID, PreKeyID: p.PreKeyID, PreKeyPub: p.PreKeyPublic})
	}
	if err := h.Keys.UploadOneTimePrekeys(c.Request.Context(), deviceID, prekeys); err != nil {
		h.audit(c, "keys.prekeys.upload.failed", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
			"error":      err.Error(),
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.audit(c, "keys.prekeys.upload.succeeded", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(deviceID), gin.H{
		"prekeys_uploaded": len(req.OneTimePreKeys),
		"request_id":       middleware.CurrentRequestID(c),
	})
	c.Status(http.StatusCreated)
}

func (h *Handler) GetKeyBundle(c *gin.Context) {
	targetUserID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || targetUserID <= 0 {
		h.audit(c, "keys.bundle.fetch.invalid_request", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"request_id": middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}
	bundle, err := h.Keys.GetBundle(c.Request.Context(), targetUserID)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, sql.ErrNoRows) {
			status = http.StatusNotFound
		}
		h.audit(c, "keys.bundle.fetch.failed", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"target_user_id": targetUserID,
			"error":          err.Error(),
			"request_id":     middleware.CurrentRequestID(c),
		})
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	if bundle == nil {
		h.audit(c, "keys.bundle.fetch.not_found", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
			"target_user_id": targetUserID,
			"request_id":     middleware.CurrentRequestID(c),
		})
		c.JSON(http.StatusNotFound, gin.H{"error": "bundle not found"})
		return
	}
	h.audit(c, "keys.bundle.fetch.succeeded", int64Ptr(middleware.CurrentUserID(c)), int64Ptr(middleware.CurrentDeviceID(c)), gin.H{
		"target_user_id": targetUserID,
		"request_id":     middleware.CurrentRequestID(c),
	})
	c.JSON(http.StatusOK, bundle)
}

func (h *Handler) GetPreKeyCount(c *gin.Context) {
	deviceID := middleware.CurrentDeviceID(c)
	count, err := h.Keys.GetPreKeyCount(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

package service

import (
	"context"
	"errors"
	"time"

	"securemsg/backend/internal/domain"
	"securemsg/backend/internal/repository"
)

type KeyService struct {
	store              *repository.Store
	preKeyLowThreshold int
	onLowPreKeys       func(userID int64)
	onIdentityChanged  func(targetUserID int64, changedUserID int64, identityKeyVersion int)
	preferredDeviceID  func(userID int64) (int64, bool)
}

func NewKeyService(
	store *repository.Store,
	threshold int,
	onLowPreKeys func(userID int64),
	onIdentityChanged func(targetUserID int64, changedUserID int64, identityKeyVersion int),
	preferredDeviceID func(userID int64) (int64, bool),
) *KeyService {
	return &KeyService{
		store:              store,
		preKeyLowThreshold: threshold,
		onLowPreKeys:       onLowPreKeys,
		onIdentityChanged:  onIdentityChanged,
		preferredDeviceID:  preferredDeviceID,
	}
}

func (s *KeyService) UploadInitialKeys(ctx context.Context, key domain.DeviceKey, prekeys []domain.OneTimePreKey) error {
	now := time.Now().UTC()
	key.SignedPreKeyCreated = now
	inputIdentityVersion := key.IdentityKeyVersion

	existing, err := s.store.GetDeviceKey(ctx, key.DeviceID)
	if err != nil {
		return err
	}
	identityChanged := existing != nil && existing.IdentityPublicKey != key.IdentityPublicKey
	if existing != nil {
		if identityChanged {
			key.IdentityKeyVersion = existing.IdentityKeyVersion + 1
		} else if inputIdentityVersion <= 0 {
			key.IdentityKeyVersion = existing.IdentityKeyVersion
		}
	} else if key.IdentityKeyVersion <= 0 {
		key.IdentityKeyVersion = 1
	}

	if err := s.store.UpsertDeviceKeys(ctx, key, prekeys, now); err != nil {
		return err
	}

	if identityChanged && s.onIdentityChanged != nil {
		changedUserID, err := s.store.GetUserIDByDeviceID(ctx, key.DeviceID)
		if err == nil {
			changedUserIDCopy := changedUserID
			deviceIDCopy := key.DeviceID
			_ = s.store.SaveAuditEvent(ctx, &changedUserIDCopy, &deviceIDCopy, "keys.identity.changed", map[string]any{
				"identity_key_version": key.IdentityKeyVersion,
			}, now)
			peers, peerErr := s.store.ListConversationPeerUserIDs(ctx, changedUserID)
			if peerErr == nil {
				for _, peerUserID := range peers {
					s.onIdentityChanged(peerUserID, changedUserID, key.IdentityKeyVersion)
				}
			}
		}
	}
	return nil
}

func (s *KeyService) RotateSignedPreKey(ctx context.Context, deviceID int64, prekeyID int64, prekeyPublic, signature string, expiresAt time.Time) error {
	return s.store.RotateSignedPreKey(ctx, deviceID, prekeyID, prekeyPublic, signature, expiresAt, time.Now().UTC())
}

func (s *KeyService) UploadOneTimePrekeys(ctx context.Context, deviceID int64, prekeys []domain.OneTimePreKey) error {
	return s.store.AddOneTimePrekeys(ctx, deviceID, prekeys, time.Now().UTC())
}

func (s *KeyService) GetBundle(ctx context.Context, targetUserID int64) (*repository.KeyBundle, error) {
	now := time.Now().UTC()
	if s.preferredDeviceID != nil {
		if deviceID, ok := s.preferredDeviceID(targetUserID); ok && deviceID > 0 {
			bundle, err := s.store.ReserveKeyBundleForDevice(ctx, targetUserID, deviceID, now)
			if err == nil && bundle != nil {
				count, countErr := s.store.CountAvailablePreKeys(ctx, bundle.DeviceID)
				if countErr == nil && count < int64(s.preKeyLowThreshold) && s.onLowPreKeys != nil {
					s.onLowPreKeys(targetUserID)
				}
				return bundle, nil
			}
			if err != nil && !errors.Is(err, repository.ErrNoAvailableOneTimePreKeys) {
				return nil, err
			}
		}
	}

	bundle, err := s.store.ReserveKeyBundle(ctx, targetUserID, now)
	if err != nil {
		return nil, err
	}
	if bundle == nil {
		return nil, nil
	}
	count, err := s.store.CountAvailablePreKeys(ctx, bundle.DeviceID)
	if err == nil && count < int64(s.preKeyLowThreshold) && s.onLowPreKeys != nil {
		s.onLowPreKeys(targetUserID)
	}
	return bundle, nil
}

func (s *KeyService) GetPreKeyCount(ctx context.Context, deviceID int64) (int64, error) {
	return s.store.CountAvailablePreKeys(ctx, deviceID)
}

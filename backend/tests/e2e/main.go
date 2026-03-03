package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type authStartResponse struct {
	DevOTP string `json:"dev_otp"`
}

type authVerifyResponse struct {
	AccessToken string `json:"access_token"`
	UserID      int64  `json:"user_id"`
}

type keyBundleResponse struct {
	OneTimePreKeyID int64 `json:"one_time_prekey_id"`
}

type messageNewEvent struct {
	Type            string `json:"type"`
	ServerMessageID int64  `json:"server_message_id"`
	ClientMessageID string `json:"client_message_id"`
	CreatedAt       string `json:"created_at"`
}

type messageStatusEvent struct {
	Type            string `json:"type"`
	ServerMessageID int64  `json:"server_message_id"`
	ClientMessageID string `json:"client_message_id"`
	Status          string `json:"status"`
}

type syncResponse struct {
	Items []struct {
		ClientMessageID string `json:"client_message_id"`
		SenderID        int64  `json:"sender_id"`
	} `json:"items"`
}

func main() {
	var (
		baseURL = flag.String("base-url", "http://localhost:8080", "backend base URL")
		timeout = flag.Duration("timeout", 8*time.Second, "event wait timeout")
	)
	flag.Parse()

	httpClient := &http.Client{Timeout: 10 * time.Second}
	ctx := &scenario{
		baseURL:    strings.TrimRight(*baseURL, "/"),
		httpClient: httpClient,
		timeout:    *timeout,
	}

	if err := ctx.run(); err != nil {
		log.Fatalf("E2E failed: %v", err)
	}
	fmt.Println("E2E success: auth, key upload, ws delivery/read, offline sync, and session revocation validated")
}

type scenario struct {
	baseURL    string
	httpClient *http.Client
	timeout    time.Duration
}

func (s *scenario) run() error {
	runID := fmt.Sprintf("%d", time.Now().UnixNano())
	userAIdentifier := fmt.Sprintf("e2e-a-%s@example.com", runID)
	userBIdentifier := fmt.Sprintf("e2e-b-%s@example.com", runID)

	userA, err := s.registerUser(userAIdentifier, "device-a-"+runID)
	if err != nil {
		return fmt.Errorf("register A: %w", err)
	}
	userB, err := s.registerUser(userBIdentifier, "device-b-"+runID)
	if err != nil {
		return fmt.Errorf("register B: %w", err)
	}

	if err := s.uploadKeys(userA.accessToken); err != nil {
		return fmt.Errorf("upload keys A: %w", err)
	}
	if err := s.uploadKeys(userB.accessToken); err != nil {
		return fmt.Errorf("upload keys B: %w", err)
	}

	bundle, err := s.getKeyBundle(userA.accessToken, userB.userID)
	if err != nil {
		return fmt.Errorf("get B bundle for A: %w", err)
	}

	connA, err := s.openWS(userA.accessToken)
	if err != nil {
		return fmt.Errorf("ws A connect: %w", err)
	}
	defer connA.Close()

	connB, err := s.openWS(userB.accessToken)
	if err != nil {
		return fmt.Errorf("ws B connect: %w", err)
	}

	firstClientMessageID := uuid.NewString()
	if err := s.sendMessage(connA, userB.userID, firstClientMessageID, bundle.OneTimePreKeyID, "hello-online"); err != nil {
		return fmt.Errorf("A send first message: %w", err)
	}

	firstNew, err := s.waitForMessageNew(connB, firstClientMessageID)
	if err != nil {
		return fmt.Errorf("B receive first message.new: %w", err)
	}

	if err := s.sendReadAck(connB, firstNew.ServerMessageID); err != nil {
		return fmt.Errorf("B ack read: %w", err)
	}
	if err := s.waitForReadStatus(connA, firstNew.ServerMessageID); err != nil {
		return fmt.Errorf("A receive read status: %w", err)
	}

	_ = connB.Close()

	since := time.Now().UTC().Add(-1 * time.Second)
	secondClientMessageID := uuid.NewString()
	if err := s.sendMessage(connA, userB.userID, secondClientMessageID, 0, "hello-offline"); err != nil {
		return fmt.Errorf("A send second message: %w", err)
	}
	if err := s.waitForQueuedOrDelivered(connA, secondClientMessageID); err != nil {
		return fmt.Errorf("A receive status for second message: %w", err)
	}

	synced, err := s.syncMessages(userB.accessToken, since)
	if err != nil {
		return fmt.Errorf("B sync messages: %w", err)
	}
	found := false
	for _, item := range synced.Items {
		if item.ClientMessageID == secondClientMessageID && item.SenderID == userA.userID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("offline message %s not found in sync payload", secondClientMessageID)
	}

	if err := s.logout(userA.accessToken); err != nil {
		return fmt.Errorf("logout A: %w", err)
	}
	if err := s.expectUnauthorizedMe(userA.accessToken); err != nil {
		return fmt.Errorf("session revocation check: %w", err)
	}
	if err := s.expectWSRevokedAfterLogout(connA, userB.userID); err != nil {
		return fmt.Errorf("ws session revocation check: %w", err)
	}
	return nil
}

type registeredUser struct {
	accessToken string
	userID      int64
}

func (s *scenario) registerUser(identifier string, deviceUUID string) (*registeredUser, error) {
	startPayload := map[string]any{
		"identifier": identifier,
		"purpose":    "login",
	}
	var startResp authStartResponse
	if err := s.postJSON("/v1/auth/start", "", startPayload, &startResp); err != nil {
		return nil, err
	}
	if startResp.DevOTP == "" {
		return nil, fmt.Errorf("dev_otp missing; ensure OTP_DEV_EXPOSE=true")
	}

	verifyPayload := map[string]any{
		"identifier":  identifier,
		"otp":         startResp.DevOTP,
		"device_uuid": deviceUUID,
		"platform":    "e2e",
	}
	var verifyResp authVerifyResponse
	if err := s.postJSON("/v1/auth/verify", "", verifyPayload, &verifyResp); err != nil {
		return nil, err
	}
	if verifyResp.AccessToken == "" || verifyResp.UserID == 0 {
		return nil, fmt.Errorf("invalid verify response")
	}
	return &registeredUser{accessToken: verifyResp.AccessToken, userID: verifyResp.UserID}, nil
}

func (s *scenario) uploadKeys(accessToken string) error {
	now := time.Now().UTC()
	prekeys := make([]map[string]any, 0, 30)
	for i := 1; i <= 30; i++ {
		prekeys = append(prekeys, map[string]any{
			"prekey_id":     i,
			"prekey_public": fmt.Sprintf("otpk-%d-%s", i, uuid.NewString()),
		})
	}
	payload := map[string]any{
		"registration_id":          1,
		"identity_public_key":      "identity-" + uuid.NewString(),
		"identity_key_version":     1,
		"signed_prekey_id":         1,
		"signed_prekey_public":     "spk-" + uuid.NewString(),
		"signed_prekey_signature":  "sig-" + uuid.NewString(),
		"signed_prekey_expires_at": now.Add(30 * 24 * time.Hour).Format(time.RFC3339),
		"one_time_prekeys":         prekeys,
	}
	return s.postJSON("/v1/keys/upload", accessToken, payload, nil)
}

func (s *scenario) getKeyBundle(accessToken string, targetUserID int64) (*keyBundleResponse, error) {
	path := fmt.Sprintf("/v1/keys/%d", targetUserID)
	respBody, err := s.requestJSON(http.MethodGet, path, accessToken, nil)
	if err != nil {
		return nil, err
	}
	var bundle keyBundleResponse
	if err := json.Unmarshal(respBody, &bundle); err != nil {
		return nil, err
	}
	return &bundle, nil
}

func (s *scenario) openWS(accessToken string) (*websocket.Conn, error) {
	wsURL, err := toWSURL(s.baseURL)
	if err != nil {
		return nil, err
	}
	dialURL := fmt.Sprintf("%s/v1/ws?token=%s", wsURL, url.QueryEscape(accessToken))
	conn, _, err := websocket.DefaultDialer.Dial(dialURL, nil)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func (s *scenario) sendMessage(conn *websocket.Conn, receiverUserID int64, clientMessageID string, oneTimePreKeyID int64, plaintext string) error {
	payload := map[string]any{
		"type":              "message.send",
		"client_message_id": clientMessageID,
		"receiver_user_id":  receiverUserID,
		"ciphertext_b64":    base64.StdEncoding.EncodeToString([]byte(plaintext)),
		"header": map[string]any{
			"session_version":             1,
			"sender_identity_pub_b64":     "e2e-identity",
			"sender_ephemeral_pub_b64":    "e2e-eph",
			"receiver_one_time_prekey_id": oneTimePreKeyID,
			"ratchet_pub_b64":             "e2e-ratchet",
			"message_index":               1,
		},
		"sent_at_client": time.Now().UTC().Format(time.RFC3339),
	}
	return conn.WriteJSON(payload)
}

func (s *scenario) sendReadAck(conn *websocket.Conn, messageID int64) error {
	return conn.WriteJSON(map[string]any{
		"type":              "message.ack.read",
		"server_message_id": messageID,
	})
}

func (s *scenario) waitForMessageNew(conn *websocket.Conn, clientMessageID string) (*messageNewEvent, error) {
	deadline := time.Now().Add(s.timeout)
	for {
		if err := conn.SetReadDeadline(deadline); err != nil {
			return nil, err
		}
		_, payload, err := conn.ReadMessage()
		if err != nil {
			return nil, err
		}
		var event messageNewEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			continue
		}
		if event.Type == "message.new" && event.ClientMessageID == clientMessageID {
			return &event, nil
		}
	}
}

func (s *scenario) waitForReadStatus(conn *websocket.Conn, messageID int64) error {
	deadline := time.Now().Add(s.timeout)
	for {
		if err := conn.SetReadDeadline(deadline); err != nil {
			return err
		}
		_, payload, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		var event messageStatusEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			continue
		}
		if event.Type == "message.status" && event.ServerMessageID == messageID && event.Status == "read" {
			return nil
		}
	}
}

func (s *scenario) waitForQueuedOrDelivered(conn *websocket.Conn, clientMessageID string) error {
	deadline := time.Now().Add(s.timeout)
	for {
		if err := conn.SetReadDeadline(deadline); err != nil {
			return err
		}
		_, payload, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		var event messageStatusEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			continue
		}
		if event.Type == "message.status" && event.ClientMessageID == clientMessageID {
			if event.Status == "queued" || event.Status == "delivered" {
				return nil
			}
		}
	}
}

func (s *scenario) syncMessages(accessToken string, since time.Time) (*syncResponse, error) {
	path := fmt.Sprintf("/v1/messages/sync?since=%s&limit=100", url.QueryEscape(since.Format(time.RFC3339)))
	body, err := s.requestJSON(http.MethodGet, path, accessToken, nil)
	if err != nil {
		return nil, err
	}
	var response syncResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (s *scenario) logout(accessToken string) error {
	_, err := s.requestJSON(http.MethodPost, "/v1/auth/logout", accessToken, nil)
	return err
}

func (s *scenario) expectUnauthorizedMe(accessToken string) error {
	request, err := http.NewRequest(http.MethodGet, s.baseURL+"/v1/me", nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)
	response, err := s.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		body, _ := io.ReadAll(response.Body)
		return fmt.Errorf("expected 401 from /v1/me, got status=%d body=%s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func (s *scenario) expectWSRevokedAfterLogout(conn *websocket.Conn, receiverUserID int64) error {
	revokedClientMessageID := uuid.NewString()
	if err := s.sendMessage(conn, receiverUserID, revokedClientMessageID, 0, "post-logout-should-fail"); err != nil {
		// Already disconnected is acceptable.
		return nil
	}

	deadline := time.Now().Add(s.timeout)
	for {
		if err := conn.SetReadDeadline(deadline); err != nil {
			return err
		}
		_, payload, err := conn.ReadMessage()
		if err != nil {
			// Socket closed by server as expected.
			return nil
		}
		var event map[string]any
		if err := json.Unmarshal(payload, &event); err != nil {
			continue
		}

		eventType, _ := event["type"].(string)
		if eventType == "error" {
			errorText := fmt.Sprint(event["error"])
			if strings.Contains(strings.ToLower(errorText), "session inactive") {
				return nil
			}
			return fmt.Errorf("unexpected ws error after logout: %s", errorText)
		}
		if eventType == "message.status" {
			clientMessageID, _ := event["client_message_id"].(string)
			if clientMessageID == revokedClientMessageID {
				return fmt.Errorf("revoked websocket still accepted message id=%s", revokedClientMessageID)
			}
		}
	}
}

func (s *scenario) postJSON(path string, accessToken string, payload any, out any) error {
	body, err := s.requestJSON(http.MethodPost, path, accessToken, payload)
	if err != nil {
		return err
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(body, out)
}

func (s *scenario) requestJSON(method string, path string, accessToken string, payload any) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(body)
	}
	request, err := http.NewRequest(method, s.baseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("%s %s failed status=%d body=%s", method, path, response.StatusCode, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func toWSURL(httpBase string) (string, error) {
	u, err := url.Parse(httpBase)
	if err != nil {
		return "", err
	}
	switch u.Scheme {
	case "http":
		u.Scheme = "ws"
	case "https":
		u.Scheme = "wss"
	default:
		return "", fmt.Errorf("unsupported base url scheme: %s", u.Scheme)
	}
	u.Path = strings.TrimRight(u.Path, "/")
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/"), nil
}

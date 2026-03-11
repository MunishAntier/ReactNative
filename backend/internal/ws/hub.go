package ws

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn     *websocket.Conn
	userID   int64
	deviceID int64
	send     chan []byte
	hub      *Hub
}

type Hub struct {
	mu               sync.RWMutex
	clients          map[int64]map[*Client]struct{}
	preferredDevices map[int64]int64
}

type DisconnectError struct {
	reason error
}

func (e *DisconnectError) Error() string {
	if e == nil || e.reason == nil {
		return "disconnect requested"
	}
	return e.reason.Error()
}

func DisconnectWithError(err error) error {
	return &DisconnectError{reason: err}
}

func IsDisconnectError(err error) bool {
	var disconnectErr *DisconnectError
	return errors.As(err, &disconnectErr)
}

func NewHub() *Hub {
	return &Hub{
		clients:          make(map[int64]map[*Client]struct{}),
		preferredDevices: make(map[int64]int64),
	}
}

func (h *Hub) Register(conn *websocket.Conn, userID, deviceID int64) *Client {
	c := &Client{conn: conn, userID: userID, deviceID: deviceID, send: make(chan []byte, 64), hub: h}
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[userID]; !ok {
		h.clients[userID] = make(map[*Client]struct{})
	}
	h.clients[userID][c] = struct{}{}
	if deviceID > 0 {
		h.preferredDevices[userID] = deviceID
	}
	go c.writePump()
	return c
}

func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clients[c.userID]; ok {
		if _, exists := clients[c]; exists {
			delete(clients, c)
			close(c.send)
		}
		preferredDeviceID := h.preferredDevices[c.userID]
		if preferredDeviceID == c.deviceID && !h.hasDeviceClientLocked(c.userID, c.deviceID) {
			nextDeviceID, ok := h.firstDeviceIDLocked(c.userID)
			if ok {
				h.preferredDevices[c.userID] = nextDeviceID
			} else {
				delete(h.preferredDevices, c.userID)
			}
		}
		if len(clients) == 0 {
			delete(h.clients, c.userID)
			delete(h.preferredDevices, c.userID)
		}
	}
}

func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients := h.clients[userID]
	return len(clients) > 0
}

func (h *Hub) IsDeviceOnline(userID, deviceID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.hasDeviceClientLocked(userID, deviceID)
}

func (h *Hub) SendToUser(userID int64, event any) {
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		select {
		case c.send <- payload:
		default:
			go h.Unregister(c)
		}
	}
}

func (h *Hub) SendToDevice(userID, deviceID int64, event any) {
	payload, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		if c.deviceID != deviceID {
			continue
		}
		select {
		case c.send <- payload:
		default:
			go h.Unregister(c)
		}
	}
}

func (h *Hub) PreferredDeviceID(userID int64) (int64, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if deviceID, ok := h.preferredDevices[userID]; ok && h.hasDeviceClientLocked(userID, deviceID) {
		return deviceID, true
	}
	return h.firstDeviceIDLocked(userID)
}

func (c *Client) writePump() {
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
	_ = c.conn.Close()
}

func (c *Client) ReadLoop(handler func(messageType int, payload []byte) error) {
	defer c.hub.Unregister(c)
	for {
		mt, payload, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		if err := handler(mt, payload); err != nil {
			_ = c.conn.WriteJSON(map[string]any{"type": "error", "error": err.Error()})
			if IsDisconnectError(err) {
				return
			}
		}
	}
}

func (c *Client) UserID() int64 {
	return c.userID
}

func (h *Hub) hasDeviceClientLocked(userID, deviceID int64) bool {
	for client := range h.clients[userID] {
		if client.deviceID == deviceID {
			return true
		}
	}
	return false
}

func (h *Hub) firstDeviceIDLocked(userID int64) (int64, bool) {
	for client := range h.clients[userID] {
		if client.deviceID > 0 {
			return client.deviceID, true
		}
	}
	return 0, false
}

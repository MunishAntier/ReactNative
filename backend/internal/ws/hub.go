package ws

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn   *websocket.Conn
	userID int64
	send   chan []byte
	hub    *Hub
}

type Hub struct {
	mu      sync.RWMutex
	clients map[int64]map[*Client]struct{}
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
	return &Hub{clients: make(map[int64]map[*Client]struct{})}
}

func (h *Hub) Register(conn *websocket.Conn, userID int64) *Client {
	c := &Client{conn: conn, userID: userID, send: make(chan []byte, 64), hub: h}
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[userID]; !ok {
		h.clients[userID] = make(map[*Client]struct{})
	}
	h.clients[userID][c] = struct{}{}
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
		if len(clients) == 0 {
			delete(h.clients, c.userID)
		}
	}
}

func (h *Hub) IsOnline(userID int64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients := h.clients[userID]
	return len(clients) > 0
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

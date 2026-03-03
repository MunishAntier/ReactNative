package main

import (
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type wsSendEvent struct {
	Type            string      `json:"type"`
	ClientMessageID string      `json:"client_message_id"`
	ReceiverUserID  int64       `json:"receiver_user_id"`
	CiphertextB64   string      `json:"ciphertext_b64"`
	Header          messageHead `json:"header"`
	SentAtClient    time.Time   `json:"sent_at_client"`
}

type messageHead struct {
	SessionVersion          int    `json:"session_version"`
	SenderIdentityPubB64    string `json:"sender_identity_pub_b64"`
	SenderEphemeralPubB64   string `json:"sender_ephemeral_pub_b64"`
	ReceiverOneTimePreKeyID int64  `json:"receiver_one_time_prekey_id"`
	RatchetPubB64           string `json:"ratchet_pub_b64"`
	MessageIndex            int    `json:"message_index"`
}

func main() {
	var (
		wsURL      = flag.String("ws-url", "ws://localhost:8080/v1/ws", "websocket endpoint")
		token      = flag.String("token", "", "access token")
		receiverID = flag.Int64("receiver", 0, "receiver user id")
		clients    = flag.Int("clients", 10, "number of concurrent websocket clients")
		messages   = flag.Int("messages", 100, "messages per client")
	)
	flag.Parse()

	if *token == "" || *receiverID <= 0 {
		log.Fatal("both --token and --receiver are required")
	}

	dialURL := fmt.Sprintf("%s?token=%s", *wsURL, *token)
	payload := base64.StdEncoding.EncodeToString([]byte("load-test-message"))

	var sent int64
	var failed int64
	start := time.Now()
	wg := sync.WaitGroup{}

	for i := 0; i < *clients; i++ {
		wg.Add(1)
		go func(clientIndex int) {
			defer wg.Done()
			conn, _, err := websocket.DefaultDialer.Dial(dialURL, nil)
			if err != nil {
				log.Printf("client=%d dial failed: %v", clientIndex, err)
				atomic.AddInt64(&failed, int64(*messages))
				return
			}
			defer conn.Close()

			_ = conn.SetReadDeadline(time.Now().Add(50 * time.Millisecond))
			for j := 0; j < *messages; j++ {
				event := wsSendEvent{
					Type:            "message.send",
					ClientMessageID: uuid.NewString(),
					ReceiverUserID:  *receiverID,
					CiphertextB64:   payload,
					Header: messageHead{
						SessionVersion:          1,
						SenderIdentityPubB64:    "load-test",
						SenderEphemeralPubB64:   "load-test",
						ReceiverOneTimePreKeyID: 0,
						RatchetPubB64:           "load-test",
						MessageIndex:            j,
					},
					SentAtClient: time.Now().UTC(),
				}
				if err := conn.WriteJSON(event); err != nil {
					atomic.AddInt64(&failed, 1)
					continue
				}
				atomic.AddInt64(&sent, 1)
				_, _, _ = conn.ReadMessage()
			}
		}(i)
	}

	wg.Wait()
	duration := time.Since(start)
	total := int64(*clients * *messages)
	throughput := float64(sent) / duration.Seconds()
	fmt.Printf("total_target=%d sent=%d failed=%d duration=%s throughput=%.2f msg/s\n", total, sent, failed, duration.Round(time.Millisecond), throughput)
}

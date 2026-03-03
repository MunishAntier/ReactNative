FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/securemsg ./cmd/api

FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=builder /bin/securemsg /app/securemsg
COPY --from=builder /app/migrations /app/migrations
EXPOSE 8080
ENTRYPOINT ["/app/securemsg"]

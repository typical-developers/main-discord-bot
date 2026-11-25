FROM golang:1.27 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /main-discord-bot ./cmd/bot

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /main-discord-bot /main-discord-bot

ENTRYPOINT ["/main-discord-bot"]

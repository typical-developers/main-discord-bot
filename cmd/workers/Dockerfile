FROM golang:1.27 AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /workers ./cmd/workers

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /workers /workers

ENTRYPOINT ["/workers"]

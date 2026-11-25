FROM golang:1.26 AS build

ARG GOOSE_VERSION=v3.27.1

RUN CGO_ENABLED=0 go install \
    github.com/pressly/goose/v3/cmd/goose@${GOOSE_VERSION}

FROM gcr.io/distroless/static-debian12:nonroot AS runtime

COPY --from=build /go/bin/goose /goose
COPY internal/database/migrations /migrations

ENV GOOSE_DRIVER=postgres
ENV GOOSE_MIGRATION_DIR=/migrations

ENTRYPOINT ["/goose"]
CMD ["up"]

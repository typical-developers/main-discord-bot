package database

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

const (
	transactionTimeout = time.Second * 60
)

type TransactionFunc func(ctx context.Context, q gen.Querier) error

type Database struct {
	pool    *pgxpool.Pool
	queries *gen.Queries
}

func NewDatabase(pool *pgxpool.Pool) *Database {
	return (&Database{
		pool:    pool,
		queries: gen.New(pool),
	}).init()
}

// init will initalize all of the stores for the database.
func (db *Database) init() *Database {
	return db
}

// WithTx will allow running a transaction inside of a callback function.
// Transactions are given 1 minute to execute, otherwise it will timeout.
//
// This is useful in circumstances where you need to execute other logic inside of the transaction.
func (db *Database) WithTx(ctx context.Context, fn TransactionFunc) error {
	ctx, cancel := context.WithTimeout(ctx, transactionTimeout)
	defer cancel()

	return pgx.BeginFunc(ctx, db.pool, func(tx pgx.Tx) error {
		return fn(ctx, db.queries.WithTx(tx))
	})
}

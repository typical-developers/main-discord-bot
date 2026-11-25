package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

const (
	transactionTimeout = time.Second * 60
)

type TransactionFunc func(ctx context.Context, txDb *Database) error

type Database struct {
	pool    *pgxpool.Pool
	dbtx    gen.DBTX
	queries *gen.Queries

	Guilds       *guilds
	Members      *members
	Leaderboards *leaderboards
	VoiceRooms   *voiceRooms
}

func New(pool *pgxpool.Pool) *Database {
	queries := gen.New()

	return (&Database{
		pool:    pool,
		dbtx:    pool,
		queries: queries,
	}).init()
}

// NewPool creates a connection pool that knows about the custom types used in the schema.
//
// SNOWFLAKE is a domain over NUMERIC(20, 0). Postgres reports plain domain columns as their base type,
// but SNOWFLAKE[] columns have their own type OID that pgx does not know about, so both types are
// registered on every new connection. Migrations must have been run before connecting.
func NewPool(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	config.AfterConnect = registerTypes

	return pgxpool.NewWithConfig(ctx, config)
}

func registerTypes(ctx context.Context, conn *pgx.Conn) error {
	// order matters, the array type depends on the element type being registered.
	for _, typeName := range []string{"snowflake", "_snowflake"} {
		dataType, err := conn.LoadType(ctx, typeName)
		if err != nil {
			return fmt.Errorf("failed to load %s type (have migrations been run?): %w", typeName, err)
		}

		conn.TypeMap().RegisterType(dataType)
	}

	return nil
}

// init will initalize all of the stores for the database.
func (db *Database) init() *Database {
	db.Guilds = newGuilds(db)
	db.Members = newMembers(db)
	db.Leaderboards = newLeaderboards(db)
	db.VoiceRooms = newVoiceRooms(db)

	return db
}

// WithTx will allow running a transaction inside of a callback function.
// Transactions are given 1 minute to execute, otherwise it will timeout.
//
// This is useful in circumstances where you need to execute other logic inside of the transaction.
// Calling WithTx on a database that is already inside of a transaction creates a savepoint,
// so store methods that use transactions internally can safely be called from txDb.
func (db *Database) WithTx(ctx context.Context, txFn TransactionFunc) error {
	ctx, cancel := context.WithTimeout(ctx, transactionTimeout)
	defer cancel()

	var (
		tx  pgx.Tx
		err error
	)
	if parent, ok := db.dbtx.(pgx.Tx); ok {
		tx, err = parent.Begin(ctx)
	} else {
		tx, err = db.pool.Begin(ctx)
	}
	if err != nil {
		return err
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	// uses a new database object with the transaction
	if err := txFn(ctx, (&Database{
		pool:    db.pool,
		dbtx:    tx,
		queries: db.queries,
	}).init()); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	committed = true
	return nil
}

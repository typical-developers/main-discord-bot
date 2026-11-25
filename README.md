# Main Discord Bot
The main Discord bot used in Typical Developers' associated Discord servers.

# Database
## Internal Methods
sqlc is used to generate internal methods used for the database. sqlc was chosen since it will error if queries have anything that do not match the schema, making database development easier. To update the schema's generation, simply run the command below:
```
sqlc generate -f internal/database/sqlc.yaml
```
## Migrations
goose is used to generate and run migrations for the database. Please refer to [goose's documentation](https://pressly.github.io/goose/documentation/annotations) for more information on how it works.
### Creating Migrations
```
goose -dir ./internal/database/sql/migrations create {MIGRATION_NAME} sql
```
### Running `up` Migrations
> [!NOTE]
> Both `GOOSE_DRIVER` and `GOOSE_DBSTRING` must be set when running this command.
> ```env
> GOOSE_DRIVER=postgres
> GOOSE_DBSTRING=postgres://admin:admin@localhost:5432/admin_db
> ```
```bash
goose -dir ./internal/database/sql/migrations up
```

# Bot Structure
```
cmd/bot/main.go            entrypoint: config, database, cache, client, startup/shutdown
cmd/bot/commands           one file per command; commands.go lists them
cmd/bot/handlers           interaction middleware
cmd/bot/listeners          gateway listeners; listeners.go registers them
typical/typical.go         wires commands and listeners to the client, syncs commands, handles errors
internal/config            environment configuration
internal/disgox            helpers on top of disgo
```

## Adding a command
1. Create `cmd/bot/commands/<name>.go` with a type that implements `commands.Command`:
```go
type helloCommand struct {
	db *database.Database
}

func newHelloCommand(db *database.Database) *helloCommand {
	return &helloCommand{db}
}

func (c *helloCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{Name: "hello", Description: "Say hello."}
}

// The router is already scoped to "/hello".
func (c *helloCommand) Register(r handler.Router) {
	r.SlashCommand("/", c.hello)          // /hello
	r.ButtonComponent("/again", c.again)  // custom ID "/hello/again"
}
```
2. Add `newHelloCommand(db)` to `GlobalCommands`, or to a guild in `GuildCommands`, in `commands.go`.

Subcommands are registered as `r.SlashCommand("/<subcommand>", ...)`, and autocomplete as `r.Autocomplete("/", ...)`. Command names cannot contain `/`, since the name is used as the route.

## Adding a listener
1. Create `cmd/bot/listeners/<name>.go` returning an `*events.ListenerAdapter` (see `guild_registrar.go`).
2. Add it to `Register` in `listeners.go`, and enable any gateway intents it needs in `cmd/bot/main.go`.

Events are handled concurrently, so listeners that keep state must guard it with a mutex.

## Errors and middleware
- Return `disgox.UserErrorf(...)` or `disgox.WrapUserError(err, "...")` to show a message to the user. Any other error is logged and the user gets a generic message.
- Panics in handlers are recovered and treated as errors.
- `handlers.GuildOnly` and `handlers.RequirePermissions(perms)` can be applied with `r.Use(...)` inside `Register`.
- Use `e.Ctx` for database calls in handlers. Listeners have no context, so create one with a timeout.

## Development
Set `DISCORD_DEV_GUILD_ID` to sync every command to one guild, which updates instantly. Global commands are not touched in this mode.

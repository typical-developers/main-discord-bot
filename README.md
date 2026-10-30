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
package config

import (
	"fmt"
	"log/slog"
	"net/url"
	"slices"
	"time"

	"github.com/caarlos0/env/v10"
	"github.com/disgoorg/snowflake/v2"
)

const (
	EnvironmentProduction  = "production"
	EnvironmentDevelopment = "development"
)

type Config struct {
	// production or development. Controls which set of custom emojis is used.
	Environment string `env:"ENVIRONMENT" envDefault:"production"`

	Discord struct {
		// The token for the Discord bot.
		Token string `env:"TOKEN,required"`
	} `envPrefix:"DISCORD_"`

	Moderation struct {
		// Guilds where members are disconnected from voice when they turn on their camera.
		DisableCameraGuildIDs []snowflake.ID `env:"DISABLE_CAMERA_GUILD_IDS" envDefault:"865737627712749579"`

		// Categories where GIF spam is limited. Channels and threads inside them are covered.
		GIFSpamCategoryIDs []snowflake.ID `env:"GIF_SPAM_CATEGORY_IDS"`
		// How far back GIFs are counted.
		GIFSpamCooldown time.Duration `env:"GIF_SPAM_COOLDOWN" envDefault:"5s"`
		// How many GIFs a channel can have within the cooldown before more are deleted.
		GIFSpamMaxMessages int `env:"GIF_SPAM_MAX_MESSAGES" envDefault:"2"`
	} `envPrefix:"MODERATION_"`

	// Users allowed to run /migrate-member-profile.
	ProfileMigrationUserIDs []snowflake.ID `env:"PROFILE_MIGRATION_USER_IDS" envDefault:"399416615742996480"`

	// PostgreSQL database connection.
	Database struct {
		Username string  `env:"USERNAME" envDefault:"postgres"`
		Password *string `env:"PASSWORD"`
		Host     string  `env:"HOST,required"`
		Port     int     `env:"PORT,required"`
		DB       string  `env:"DB" envDefault:"postgres"`
		SSLMode  string  `env:"SSL_MODE" envDefault:"prefer"`
	} `envPrefix:"DATABASE_"`

	Redis struct {
		// Optional. When set, disgo's cache is stored in Redis and the client is
		// available to modules through Deps.Redis.
		URL string `env:"URL"`
	} `envPrefix:"REDIS_"`

	// debug, info, warn or error.
	LogLevel slog.Level `env:"LOG_LEVEL" envDefault:"info"`
}

// Load reads the configuration from the environment.
func Load() (*Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}

	if c.Environment != EnvironmentProduction && c.Environment != EnvironmentDevelopment {
		return nil, fmt.Errorf("config: ENVIRONMENT must be %q or %q, got %q", EnvironmentProduction, EnvironmentDevelopment, c.Environment)
	}

	return &c, nil
}

func (c *Config) IsProduction() bool {
	return c.Environment == EnvironmentProduction
}

// CanMigrateProfiles reports whether the user may run /migrate-member-profile.
func (c *Config) CanMigrateProfiles(userID snowflake.ID) bool {
	return slices.Contains(c.ProfileMigrationUserIDs, userID)
}

func (c *Config) DatabaseURL() string {
	u := url.URL{
		Scheme: "postgres",
		Host:   fmt.Sprintf("%s:%d", c.Database.Host, c.Database.Port),
		Path:   c.Database.DB,
	}

	if c.Database.Password != nil {
		u.User = url.UserPassword(c.Database.Username, *c.Database.Password)
	} else {
		u.User = url.User(c.Database.Username)
	}

	q := u.Query()
	q.Set("timezone", "UTC")
	q.Set("sslmode", c.Database.SSLMode)
	u.RawQuery = q.Encode()

	return u.String()
}

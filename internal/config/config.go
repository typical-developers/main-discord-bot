package config

import (
	"fmt"
	"log/slog"
	"net/url"

	"github.com/caarlos0/env/v10"
)

type Config struct {
	Discord struct {
		// The token for the Discord bot.
		Token string `env:"TOKEN,required"`
	} `envPrefix:"DISCORD_"`

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

	return &c, nil
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

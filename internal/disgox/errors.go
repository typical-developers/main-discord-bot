package disgox

import "fmt"

// UserError is an error whose message is safe to show to the user.
// When a handler or middleware returns one, the interaction error handler
// replies with its message instead of the generic error response.
type UserError struct {
	Message string
	Err     error
}

func (e *UserError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}

	return e.Message
}

func (e *UserError) Unwrap() error {
	return e.Err
}

// UserErrorf returns a UserError with a formatted message.
func UserErrorf(format string, args ...any) error {
	return &UserError{Message: fmt.Sprintf(format, args...)}
}

// WrapUserError shows message to the user while keeping err for logging and errors.Is.
func WrapUserError(err error, message string) error {
	return &UserError{Message: message, Err: err}
}

// Package ptr has helpers for optional values, such as nullable database columns.
package ptr

// Value returns the value p points to, or T's zero value when p is nil.
func Value[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}

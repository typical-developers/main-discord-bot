package jobs

import (
	"context"
	"fmt"
	"reflect"
	"runtime"
	"strings"
)

type Config struct {
	Enabled bool
}

type JobFunc func(ctx context.Context)

type Job struct {
	Spec    string
	Config  Config
	JobFunc JobFunc
}

func NewJob(spec string, config Config, cmd JobFunc) *Job {
	j := &Job{
		Spec:    spec,
		Config:  config,
		JobFunc: cmd,
	}

	return j
}

func (j *Job) Run(ctx context.Context) func() {
	return func() {
		j.JobFunc(ctx)
	}
}

// Name will get the name of the job based on the provided function.
func (j *Job) Name() string {
	rf := runtime.FuncForPC(reflect.ValueOf(j.JobFunc).Pointer())
	if rf == nil {
		return fmt.Sprintf("Job %s", j.Spec)
	}

	name := rf.Name()
	if idx := strings.LastIndex(name, "."); idx >= 0 && idx < len(name)-1 {
		name = name[idx+1:]
	}

	return strings.TrimSuffix(name, "-fm")
}

package jobs

import (
	"context"
	"runtime"

	"github.com/robfig/cron/v3"
)

type Handler struct {
	ctx context.Context
	c   *cron.Cron
}

type HandlerOption func(*Handler)

func NewHandler(opts ...HandlerOption) *Handler {
	h := &Handler{
		ctx: context.TODO(),
		c:   cron.New(),
	}

	for _, opt := range opts {
		opt(h)
	}

	return h
}

func WithCron(cron *cron.Cron) HandlerOption {
	return func(h *Handler) {
		h.c = cron
	}
}

func (h *Handler) AddJobs(jobs ...Job) {
	for _, job := range jobs {
		if !job.Config.Enabled {
			continue
		}

		wrappers := []cron.JobWrapper{
			cron.SkipIfStillRunning(cron.DefaultLogger),
		}

		chain := cron.
			NewChain(wrappers...).
			Then(cron.FuncJob(job.Run(h.ctx)))
		if _, err := h.c.AddFunc(job.Spec, chain.Run); err != nil {
			println(err.Error())
		}
	}
}

func (h *Handler) Start() {
	h.c.Start()
	runtime.Goexit()
}

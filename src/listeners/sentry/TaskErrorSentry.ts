import { err, Listener } from '@sapphire/framework';
import { ScheduledTaskEvents, type ScheduledTask, type ScheduledTasks } from '@sapphire/plugin-scheduled-tasks'
import { ApplyOptions } from '@sapphire/decorators';
import type TaskError from '@/lib/extensions/TaskError';

@ApplyOptions<Listener.Options>({
    event: ScheduledTaskEvents.ScheduledTaskError,
    once: false
})
export class TaskErrorSentry extends Listener {
    public override async run(error: TaskError, _: ScheduledTask) {
        if (!this.container.client.isReady()) return; // Such as channels not existing.

        const taskList = await this.container.tasks.client.getJobs(['active' ,'delayed' ,'prioritized' ,'waiting' ,'waiting-children']);

        /**
         * TODO: Figure out a way to do this better.
         */
        switch (true) {
            case error.task === 'IncrementVoiceActivity':
                let incTask = taskList.find((j) => (j.data as ScheduledTasks['IncrementVoiceActivity'])?.memberId === (error.payload as ScheduledTasks['IncrementVoiceActivity']).memberId);
                if (incTask) this.container.tasks.client.removeJobScheduler(incTask.repeatJobKey!);
                break;
            case error.task === 'RemoveSlowmode':
                let slowmodeTask = taskList.find((j) => (j.data as ScheduledTasks['RemoveSlowmode'])?.channelId === (error.payload as ScheduledTasks['RemoveSlowmode']).channelId);
                if (slowmodeTask) this.container.tasks.client.removeJobScheduler(slowmodeTask.repeatJobKey!);
                break;
        }
    }
}

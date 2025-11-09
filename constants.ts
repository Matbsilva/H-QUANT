
import { KanbanStatus } from './types';

export const KANBAN_COLUMNS: KanbanStatus[] = [
    KanbanStatus.Backlog,
    KanbanStatus.InProgress,
    KanbanStatus.ReadyToSend,
    KanbanStatus.Sent,
    KanbanStatus.Waiting,
    KanbanStatus.Approved,
    KanbanStatus.Declined,
    KanbanStatus.Archived,
];

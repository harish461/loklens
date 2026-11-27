import * as migration_20261109_112620_initial from './20261109_112620_initial';
import * as migration_20261112_105238_reporter_workflow from './20261112_105238_reporter_workflow';
import * as migration_20261113_080618_add_media_storage_fields from './20261113_080618_add_media_storage_fields';
import * as migration_20261124_114007_add_app_users from './20261124_114007_add_app_users';
import * as migration_20261126_125206_push_notifications from './20261126_125206_push_notifications';
import * as migration_20261126_131229_push_job_tasks from './20261126_131229_push_job_tasks';
import * as migration_20261127_071849_push_send_lease from './20261127_071849_push_send_lease';

export const migrations = [
  {
    up: migration_20261109_112620_initial.up,
    down: migration_20261109_112620_initial.down,
    name: '20261109_112620_initial',
  },
  {
    up: migration_20261112_105238_reporter_workflow.up,
    down: migration_20261112_105238_reporter_workflow.down,
    name: '20261112_105238_reporter_workflow',
  },
  {
    up: migration_20261113_080618_add_media_storage_fields.up,
    down: migration_20261113_080618_add_media_storage_fields.down,
    name: '20261113_080618_add_media_storage_fields',
  },
  {
    up: migration_20261124_114007_add_app_users.up,
    down: migration_20261124_114007_add_app_users.down,
    name: '20261124_114007_add_app_users',
  },
  {
    up: migration_20261126_125206_push_notifications.up,
    down: migration_20261126_125206_push_notifications.down,
    name: '20261126_125206_push_notifications',
  },
  {
    up: migration_20261126_131229_push_job_tasks.up,
    down: migration_20261126_131229_push_job_tasks.down,
    name: '20261126_131229_push_job_tasks',
  },
  {
    up: migration_20261127_071849_push_send_lease.up,
    down: migration_20261127_071849_push_send_lease.down,
    name: '20261127_071849_push_send_lease'
  },
];

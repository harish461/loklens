import * as migration_20261109_112620_initial from './20261109_112620_initial';
import * as migration_20261112_105238_reporter_workflow from './20261112_105238_reporter_workflow';
import * as migration_20261113_080618_add_media_storage_fields from './20261113_080618_add_media_storage_fields';
import * as migration_20261124_114007_add_app_users from './20261124_114007_add_app_users';
import * as migration_20261126_125206_push_notifications from './20261126_125206_push_notifications';
import * as migration_20261126_131229_push_job_tasks from './20261126_131229_push_job_tasks';
import * as migration_20261127_071849_push_send_lease from './20261127_071849_push_send_lease';
import * as migration_20261127_081621_enable_rls_public_tables from './20261127_081621_enable_rls_public_tables';
import * as migration_20261127_172614_youtube_studio from './20261127_172614_youtube_studio';
import * as migration_20261127_174523_footage_retention_task from './20261127_174523_footage_retention_task';
import * as migration_20261128_071732_youtube_publisher from './20261128_071732_youtube_publisher';
import * as migration_20261128_112452_footage_image_hashtags from './20261128_112452_footage_image_hashtags';

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
    name: '20261127_071849_push_send_lease',
  },
  {
    up: migration_20261127_081621_enable_rls_public_tables.up,
    down: migration_20261127_081621_enable_rls_public_tables.down,
    name: '20261127_081621_enable_rls_public_tables',
  },
  {
    up: migration_20261127_172614_youtube_studio.up,
    down: migration_20261127_172614_youtube_studio.down,
    name: '20261127_172614_youtube_studio',
  },
  {
    up: migration_20261127_174523_footage_retention_task.up,
    down: migration_20261127_174523_footage_retention_task.down,
    name: '20261127_174523_footage_retention_task',
  },
  {
    up: migration_20261128_071732_youtube_publisher.up,
    down: migration_20261128_071732_youtube_publisher.down,
    name: '20261128_071732_youtube_publisher',
  },
  {
    up: migration_20261128_112452_footage_image_hashtags.up,
    down: migration_20261128_112452_footage_image_hashtags.down,
    name: '20261128_112452_footage_image_hashtags'
  },
];

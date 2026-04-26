import alasql from 'alasql';
import type { ReviewEventEnvelope } from './types';

const DB_NAME = 'directoros_review_db';

type SqlRow = {
  event_id: string;
  event_type: ReviewEventEnvelope['eventType'];
  occurred_at: number;
  project_id: string;
  scene_id: string;
  shot_id: string;
  job_id: string;
  lineage_root_job_id: string;
  queue_id: string;
  connector_id: string;
  payload_json: string;
  idempotency_key: string;
};

let initialized = false;

const init = () => {
  if (initialized) return;
  try {
    alasql(`CREATE DATABASE ${DB_NAME}`);
  } catch {
    // Database already exists in current runtime.
  }
  alasql(`USE ${DB_NAME}`);
  alasql(`
    CREATE TABLE IF NOT EXISTS review_event_log (
      event_id STRING,
      event_type STRING,
      occurred_at NUMBER,
      project_id STRING,
      scene_id STRING,
      shot_id STRING,
      job_id STRING,
      lineage_root_job_id STRING,
      queue_id STRING,
      connector_id STRING,
      payload_json STRING,
      idempotency_key STRING,
      PRIMARY KEY (event_id)
    )
  `);
  try {
    alasql('CREATE UNIQUE INDEX idx_review_event_log_idempotency ON review_event_log(idempotency_key)');
  } catch {
    // Index already exists in current runtime.
  }
  initialized = true;
};

const toEnvelope = (row: SqlRow): ReviewEventEnvelope => ({
  eventId: row.event_id,
  eventType: row.event_type,
  occurredAt: row.occurred_at,
  projectId: row.project_id,
  sceneId: row.scene_id,
  shotId: row.shot_id,
  jobId: row.job_id,
  lineageRootJobId: row.lineage_root_job_id,
  queueId: row.queue_id,
  connectorId: row.connector_id,
  payload: JSON.parse(row.payload_json),
  idempotencyKey: row.idempotency_key,
});

class ReviewEventStore {
  constructor() {
    init();
  }

  append(event: ReviewEventEnvelope): { accepted: boolean; duplicateOf?: string } {
    init();

    const duplicate = alasql('SELECT event_id FROM review_event_log WHERE idempotency_key = ? LIMIT 1', [event.idempotencyKey]) as Array<{ event_id: string }>;
    if (duplicate.length) {
      return { accepted: false, duplicateOf: duplicate[0].event_id };
    }

    alasql(
      `INSERT INTO review_event_log
      (event_id,event_type,occurred_at,project_id,scene_id,shot_id,job_id,lineage_root_job_id,queue_id,connector_id,payload_json,idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        event.eventId,
        event.eventType,
        event.occurredAt,
        event.projectId,
        event.sceneId,
        event.shotId,
        event.jobId,
        event.lineageRootJobId,
        event.queueId,
        event.connectorId,
        JSON.stringify(event.payload ?? {}),
        event.idempotencyKey,
      ]
    );

    // Memory Armor: Simple prune when exceeding 1000 items
    const rowCount = (alasql('SELECT COUNT(*) as cnt FROM review_event_log') as Array<{ cnt: number }>)[0].cnt;
    if (rowCount > 1100) {
      alasql('DELETE FROM review_event_log WHERE event_id IN (SELECT event_id FROM review_event_log ORDER BY occurred_at ASC LIMIT 200)');
    }

    return { accepted: true };
  }

  list(): ReviewEventEnvelope[] {
    init();
    const rows = alasql('SELECT * FROM review_event_log ORDER BY occurred_at ASC, event_id ASC') as SqlRow[];
    return rows.map(toEnvelope);
  }

  clear() {
    init();
    alasql('DELETE FROM review_event_log');
  }
}

export const reviewEventStore = new ReviewEventStore();

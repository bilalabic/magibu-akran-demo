import "server-only";

import { PgBoss, type QueueOptions } from "pg-boss";

import type { EmailJobPayload } from "@/lib/email/process";
import {
  JOB_QUEUES,
  QUEUE_BY_SCHEDULED_JOB,
  type ScheduledJobName,
} from "@/lib/jobs/queues";

type BossMode = "producer" | "worker";

type BossState = {
  instance?: PgBoss;
  startPromise?: Promise<PgBoss>;
  mode?: BossMode;
};

const globalForBoss = globalThis as unknown as { pgBossState?: BossState };
const state = globalForBoss.pgBossState ?? {};
globalForBoss.pgBossState = state;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function queueConnectionString(): string {
  const value =
    process.env.PGBOSS_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "PGBOSS_DATABASE_URL, DIRECT_URL veya DATABASE_URL değişkenlerinden biri tanımlanmalıdır.",
    );
  }
  return value;
}

async function createQueues(boss: PgBoss): Promise<void> {
  const commonCronOptions: QueueOptions = {
    expireInSeconds: 15 * 60,
    retentionSeconds: 14 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
    retryLimit: 3,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 15 * 60,
  };

  await boss.createQueue(JOB_QUEUES.deadLetter, {
    policy: "standard",
    retryLimit: 0,
    retentionSeconds: 30 * 24 * 60 * 60,
    deleteAfterSeconds: 30 * 24 * 60 * 60,
  });
  await boss.createQueue(JOB_QUEUES.email, {
    policy: "exclusive",
    expireInSeconds: 5 * 60,
    retentionSeconds: 14 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 60 * 60,
    deadLetter: JOB_QUEUES.deadLetter,
    warningQueueSize: 500,
  });

  for (const queue of Object.values(QUEUE_BY_SCHEDULED_JOB)) {
    await boss.createQueue(queue, {
      ...commonCronOptions,
      policy: "exclusive",
      deadLetter: JOB_QUEUES.deadLetter,
      warningQueueSize: 20,
    });
  }
}

export async function getBoss(mode: BossMode = "producer"): Promise<PgBoss> {
  if (state.startPromise) return state.startPromise;

  state.mode = mode;
  const boss = new PgBoss({
    connectionString: queueConnectionString(),
    schema: process.env.PGBOSS_SCHEMA ?? "pgboss",
    application_name: `magibudemo-${mode}`,
    max: positiveInt(process.env.PGBOSS_POOL_MAX, mode === "worker" ? 5 : 3),
    connectionTimeoutMillis: positiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 5_000),
    schedule: mode === "worker",
    supervise: mode === "worker",
    migrate: true,
    createSchema: true,
    useListenNotify: false,
    warningQueueSize: 500,
  });

  boss.on("error", (error) => console.error("[pg-boss] hata:", error));
  boss.on("warning", (warning) => console.warn("[pg-boss] uyarı:", warning));

  state.instance = boss;
  state.startPromise = boss
    .start()
    .then(async (started) => {
      await createQueues(started);
      return started;
    })
    .catch((error) => {
      // Geçici bir PostgreSQL kesintisi ilk bağlantıyı düşürürse sonraki
      // enqueue denemesi aynı reddedilmiş Promise'e takılmadan tekrar bağlanır.
      if (state.instance === boss) {
        state.instance = undefined;
        state.startPromise = undefined;
        state.mode = undefined;
      }
      throw error;
    });
  return state.startPromise;
}

export async function stopBoss(timeoutMs = 25_000): Promise<void> {
  if (!state.instance) return;
  await state.instance.stop({ graceful: true, close: true, timeout: timeoutMs });
  state.instance = undefined;
  state.startPromise = undefined;
  state.mode = undefined;
}

export async function enqueuePgBossEmail(payload: EmailJobPayload): Promise<string | null> {
  const boss = await getBoss("producer");
  return boss.send(JOB_QUEUES.email, payload, { singletonKey: payload.jobKey });
}

export async function enqueuePgBossEmails(
  payloads: EmailJobPayload[],
): Promise<string[] | null> {
  if (payloads.length === 0) return [];
  const boss = await getBoss("producer");
  return boss.insert(
    JOB_QUEUES.email,
    payloads.map((payload) => ({
      data: payload,
      singletonKey: payload.jobKey,
    })),
    { returnId: true },
  );
}

export async function enqueueScheduledJob(name: ScheduledJobName): Promise<string | null> {
  const boss = await getBoss("producer");
  return boss.send(QUEUE_BY_SCHEDULED_JOB[name], { requestedAt: new Date().toISOString() });
}

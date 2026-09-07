import type { Response } from "express";
import { logger } from "./logger";

type Client = { response: Response; close: () => void };
const operatorClients = new Map<string, Set<Client>>();
const publicClients = new Map<string, Map<string, Set<Client>>>();

function write(response: Response, event: string, payload: unknown) {
  // Serialize at the boundary so a published snapshot cannot be mutated by a
  // later database read or caller.
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function add(set: Set<Client>, response: Response): () => void {
  const client: Client = { response, close: () => {} };
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25_000);
  const close = () => {
    clearInterval(heartbeat);
    set.delete(client);
  };
  client.close = close;
  response.on("close", close);
  set.add(client);
  return close;
}

export function beginSse(response: Response) {
  response.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.flushHeaders();
}

export function subscribeOperator(eventId: string, response: Response) {
  const clients = operatorClients.get(eventId) ?? new Set<Client>();
  operatorClients.set(eventId, clients);
  return add(clients, response);
}

export function subscribePublic(eventId: string, accessId: string, response: Response) {
  const byAccess = publicClients.get(eventId) ?? new Map<string, Set<Client>>();
  publicClients.set(eventId, byAccess);
  const clients = byAccess.get(accessId) ?? new Set<Client>();
  byAccess.set(accessId, clients);
  return add(clients, response);
}

export function sendSnapshot(response: Response, eventType: string, snapshot: unknown) {
  write(response, eventType, snapshot);
}

export async function publishSnapshots(
  eventId: string,
  eventType: string,
  operatorSnapshot: () => Promise<unknown>,
  publicSnapshot: (accessId: string) => Promise<unknown | null>,
) {
  const operators = operatorClients.get(eventId);
  if (operators?.size) {
    const snapshot = await operatorSnapshot();
    for (const client of operators) write(client.response, eventType, snapshot);
  }
  const byAccess = publicClients.get(eventId);
  if (!byAccess?.size) return;
  for (const [accessId, clients] of byAccess) {
    try {
      const snapshot = await publicSnapshot(accessId);
      if (snapshot === null) {
        for (const client of clients) client.response.end();
        continue;
      }
      for (const client of clients) write(client.response, eventType, snapshot);
    } catch (error) {
      logger.warn({ error, eventId, accessId }, "Unable to publish public realtime snapshot");
    }
  }
}
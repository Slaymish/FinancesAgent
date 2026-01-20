import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { LEGACY_USER_ID } from "./constants.js";
import { prisma } from "./prisma.js";
import type { Env } from "./env.js";

export { LEGACY_USER_ID };

function headerValue(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === "string") return input[0];
  return null;
}

export function extractBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== "string") return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice("bearer ".length).trim();
  return token.length ? token : null;
}

export async function ensureLegacyUser(): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { id: LEGACY_USER_ID } });

  if (!existing) {
    return prisma.user.create({
      data: {
        id: LEGACY_USER_ID,
        name: "Legacy User"
      }
    });
  }

  return existing;
}

export async function requireUserFromInternalRequest(params: {
  req: FastifyRequest;
  reply: FastifyReply;
  env: Env;
  allowPipelineToken?: boolean;
}): Promise<User | null> {
  const { req, reply, env, allowPipelineToken } = params;
  const internalKey = headerValue(req.headers["x-internal-api-key"]);
  const pipelineHeader = headerValue(req.headers["x-pipeline-token"]);
  const bearer = extractBearerToken(req.headers.authorization);
  const pipelineToken = pipelineHeader ?? bearer;

  const hasInternalKey = internalKey != null && internalKey === env.INTERNAL_API_KEY;
  const hasPipelineToken = allowPipelineToken && env.PIPELINE_TOKEN && pipelineToken === env.PIPELINE_TOKEN;

  if (!hasInternalKey && !hasPipelineToken) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }

  const userId = headerValue(req.headers["x-user-id"])?.trim();
  if (!userId) {
    reply.code(400).send({ error: "missing_user" });
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    reply.code(404).send({ error: "user_not_found" });
    return null;
  }

  return user;
}

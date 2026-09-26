import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface ErrorEnvelope {
  error: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof ApiError) {
        reply.status(error.status).send({ error: error.code, message: error.message });
        return;
      }

      if (error.validation) {
        reply.status(400).send({ error: "VALIDATION_ERROR", message: error.message });
        return;
      }

      const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
      if (status >= 500) {
        request.log.error(error);
        reply.status(500).send({ error: "INTERNAL_ERROR", message: "Internal Server Error" });
        return;
      }

      reply.status(status).send({ error: "REQUEST_ERROR", message: error.message });
    },
  );
}

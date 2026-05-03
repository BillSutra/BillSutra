import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type ValidationSchemas = {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  statusCode?: number;
};

type ValidationErrorWithStatus = Error & {
  statusCode?: number;
};

const attachStatusCode = (error: Error, statusCode?: number) => {
  if (statusCode) {
    (error as ValidationErrorWithStatus).statusCode = statusCode;
  }
  return error;
};

const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return next(attachStatusCode(result.error, schemas.statusCode));
      }
      req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return next(attachStatusCode(result.error, schemas.statusCode));
      }
      req.params = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return next(attachStatusCode(result.error, schemas.statusCode));
      }
      Object.assign(req.query, result.data);
    }

    return next();
  };
};

export default validate;

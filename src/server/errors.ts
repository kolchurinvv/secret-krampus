/** An error whose message is safe and useful to show the user (HTTP 4xx). */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

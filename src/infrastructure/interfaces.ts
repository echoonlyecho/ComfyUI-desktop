/**
 * A type that removes the readonly modifier from all properties of a given type.
 *
 * @example
 * ```ts
 * type ReadOnlyPerson = { readonly name: string };
 * type MutablePerson = Mutable<ReadOnlyPerson>;
 * // MutablePerson is { name: string }
 * ```
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export interface FatalErrorOptions {
  /** The message to display to the user.  Also used for logging if {@link logMessage} is not set. */
  message: string;
  /** The {@link Error} to log. */
  error?: unknown;
  /** The title of the error message box. */
  title?: string;
  /** If set, this replaces the {@link message} for logging. */
  logMessage?: string;
  /** The exit code to use when the app is exited. Default: 2 */
  exitCode?: number;
}

/** A frontend page that can be loaded by the app. Must be a valid entry in the frontend router. @see {@link AppWindow.isOnPage} */
export type Page =
  | 'desktop-start'
  | 'welcome'
  | 'not-supported'
  | 'metrics-consent'
  | 'server-start'
  | ''
  | 'maintenance'
  | 'desktop-update';

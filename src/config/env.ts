import Joi from 'joi';
import {
  DEFAULT_HOST,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  ENV_KEYS,
  LOG_LEVELS,
  MIN_AUTH_TOKEN_LENGTH,
  NODE_ENVS,
  NODE_ENV_DEVELOPMENT,
  NODE_ENV_TEST,
  TRANSPORT_HTTP,
  TRANSPORT_STDIO,
} from './constants.js';

type NodeEnv = (typeof NODE_ENVS)[number];

interface BaseEnv {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly host: string;
  readonly logLevel: string;
  readonly supabaseUrl: string | undefined;
  readonly supabaseServiceKey: string | undefined;
}

interface StdioEnv extends BaseEnv {
  readonly transport: typeof TRANSPORT_STDIO;
  readonly authToken: string | undefined;
}

// El token es obligatorio solo en HTTP: el tipo lo refleja para que quien
// arranca el servidor HTTP no tenga que volver a comprobarlo.
interface HttpEnv extends BaseEnv {
  readonly transport: typeof TRANSPORT_HTTP;
  readonly authToken: string;
}

export type Env = StdioEnv | HttpEnv;

// Con Joi.empty('') una variable vacía (`SUPABASE_URL=` copiada de
// .env.example) cuenta como ausente y falla con "is required".
const requiredOutsideTest = (schema: Joi.StringSchema): Joi.StringSchema =>
  schema.empty('').when(ENV_KEYS.NODE_ENV, {
    is: NODE_ENV_TEST,
    then: Joi.optional(),
    otherwise: Joi.required(),
  });

const schema = Joi.object({
  [ENV_KEYS.NODE_ENV]: Joi.string()
    .valid(...NODE_ENVS)
    .default(NODE_ENV_DEVELOPMENT),
  [ENV_KEYS.MCP_TRANSPORT]: Joi.string()
    .valid(TRANSPORT_STDIO, TRANSPORT_HTTP)
    .default(TRANSPORT_STDIO),
  [ENV_KEYS.MCP_HOST]: Joi.alternatives()
    .try(Joi.string().ip(), Joi.string().hostname())
    .default(DEFAULT_HOST),
  [ENV_KEYS.PORT]: Joi.number().port().default(DEFAULT_PORT),
  [ENV_KEYS.LOG_LEVEL]: Joi.string()
    .valid(...LOG_LEVELS)
    .default(DEFAULT_LOG_LEVEL),
  [ENV_KEYS.MCP_AUTH_TOKEN]: Joi.string()
    .empty('')
    .min(MIN_AUTH_TOKEN_LENGTH)
    .when(ENV_KEYS.MCP_TRANSPORT, {
      is: TRANSPORT_HTTP,
      then: Joi.required(),
    }),
  [ENV_KEYS.SUPABASE_URL]: requiredOutsideTest(
    Joi.string().uri({ scheme: ['http', 'https'] }),
  ),
  [ENV_KEYS.SUPABASE_SERVICE_KEY]: requiredOutsideTest(Joi.string()),
}).options({ abortEarly: false, allowUnknown: true });

/**
 * Valida y tipa las variables de entorno. Lanza si son inválidas.
 * El mensaje nombra la variable y la regla, nunca su valor: un token o una
 * clave mal escritos no deben terminar en un log.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const { error, value } = schema.validate(source);

  if (error) {
    throw new Error(error.message);
  }

  const base: BaseEnv = {
    nodeEnv: value[ENV_KEYS.NODE_ENV] as NodeEnv,
    port: value[ENV_KEYS.PORT] as number,
    host: value[ENV_KEYS.MCP_HOST] as string,
    logLevel: value[ENV_KEYS.LOG_LEVEL] as string,
    supabaseUrl: value[ENV_KEYS.SUPABASE_URL] as string | undefined,
    supabaseServiceKey: value[ENV_KEYS.SUPABASE_SERVICE_KEY] as
      | string
      | undefined,
  };

  if (value[ENV_KEYS.MCP_TRANSPORT] === TRANSPORT_HTTP) {
    // Joi garantiza el token cuando el transporte es HTTP (regla `when`).
    const authToken = value[ENV_KEYS.MCP_AUTH_TOKEN] as string;
    return { ...base, transport: TRANSPORT_HTTP, authToken };
  }

  const authToken = value[ENV_KEYS.MCP_AUTH_TOKEN] as string | undefined;
  return { ...base, transport: TRANSPORT_STDIO, authToken };
}

function loadEnvOrExit(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    // stderr is safe — stdout is reserved for MCP protocol in stdio mode
    const message = error instanceof Error ? error.message : String(error);
    console.error('Config validation error:', message);
    return process.exit(1);
  }
}

export const env = loadEnvOrExit();

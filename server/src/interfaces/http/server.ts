export interface ServerConfig {
  port: number;
}

export function getServerConfig(): ServerConfig {
  const port = Number.parseInt(process.env.PORT ?? '5000', 10);
  
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  return { port };
}
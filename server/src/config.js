export function getAppOrigin(env = process.env) {
  const isRailway = Boolean(env.RAILWAY_PUBLIC_DOMAIN || env.RAILWAY_SERVICE_ID || env.RAILWAY_ENVIRONMENT_ID);
  return env.APP_ORIGIN
    || (env.NODE_ENV === "production" || isRailway ? "https://her-well-snowy.vercel.app" : "http://localhost:5173");
}

export const appOrigin = getAppOrigin();

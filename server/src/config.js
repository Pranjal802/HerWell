export const appOrigin = process.env.APP_ORIGIN
  || (process.env.NODE_ENV === "production" ? "https://her-well-snowy.vercel.app" : "http://localhost:5173");

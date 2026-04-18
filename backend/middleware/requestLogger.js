// middleware/requestLogger.js
import morgan from "morgan";

/**
 * Logs incoming requests in a clean, structured format.
 * Helpful for debugging and intrusion monitoring.
 */
const requestLogger = morgan(
  ":remote-addr :method :url :status :response-time ms - :res[content-length]"
);

export default requestLogger;

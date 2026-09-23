// Client identity: how a client keeps its stable id and how it names it to the server.

/** localStorage key the client uses to persist its stable identity. */
export const CLIENT_ID_STORAGE_KEY = 'evolution.clientId';
/**
 * The `/ws` query parameter a socket names its identity with (`?clientId=`): the browser client,
 * the headless bot client and the server's `resolvePlayerId` all read the one name from here.
 */
export const CLIENT_ID_QUERY_PARAMETER = 'clientId';

/**
 * The close code the server ends a socket with when another socket with the same clientId takes its seat (#273): a
 * second tab of the same browser profile. From the private-use range (4000–4999); the browser client honours it by
 * staying closed rather than reconnecting, which would take the seat back and start the two tabs trading it forever.
 */
export const SOCKET_CLOSE_CODE_REPLACED = 4001;
/** The close reason sent with `SOCKET_CLOSE_CODE_REPLACED`, for logs and a raw client. */
export const SOCKET_CLOSE_REASON_REPLACED = 'replaced by a newer connection with the same clientId';

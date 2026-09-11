// Client identity: how a client keeps its stable id and how it names it to the server.

/** localStorage key the client uses to persist its stable identity. */
export const CLIENT_ID_STORAGE_KEY = 'evolution.clientId';
/**
 * The `/ws` query parameter a socket names its identity with (`?clientId=`): the browser client,
 * the headless bot client and the server's `resolvePlayerId` all read the one name from here.
 */
export const CLIENT_ID_QUERY_PARAMETER = 'clientId';

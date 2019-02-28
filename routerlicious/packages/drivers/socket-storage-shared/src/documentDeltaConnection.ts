// tslint:disable
import {
    IClient,
    IContentMessage,
    IDocumentDeltaConnection,
    IDocumentMessage,
    ISequencedDocumentMessage,
} from "@prague/container-definitions";
import { BatchManager } from "@prague/utils";
import { EventEmitter } from "events";
import { debug } from "./debug";
import * as messages from "./messages";

/**
 * Represents a connection to a stream of delta updates
 */
export class DocumentDeltaConnection extends EventEmitter implements IDocumentDeltaConnection {
    public static async Create(
        tenantId: string,
        id: string,
        token: string,
        io: SocketIOClientStatic,
        client: IClient,
        url: string): Promise<IDocumentDeltaConnection> {

        const socket = io(
            url,
            {
                query: {
                    documentId: id,
                    tenantId,
                },
                reconnection: false,
                transports: ["websocket"],
            });

        const connectMessage: messages.IConnect = {
            client,
            id,
            tenantId,
            token,  // token is going to indicate tenant level information, etc...
        };

        const connection = await new Promise<messages.IConnected>((resolve, reject) => {
            // Listen for ops sent before we receive a response to connect_document
            const queuedMessages: ISequencedDocumentMessage[] = [];
            const queuedContents: IContentMessage[] = [];

            const earlyOpHandler = (documentId: string, msgs: ISequencedDocumentMessage[]) => {
                debug("Queued early ops", msgs.length);
                queuedMessages.push(...msgs);
            };
            socket.on("op", earlyOpHandler);

            const earlyContentHandler = (msg: IContentMessage) => {
                debug("Queued early contents");
                queuedContents.push(msg);
            };
            socket.on("op-content", earlyContentHandler);

            // Listen for connection issues
            socket.on("connect_error", (error) => {
                debug(`Socket connection error: [${error}]`);
                reject(error);
            });

            // Listen for timeouts
            socket.on("connect_timeout", () => {
                debug(`Socket connection timeout`);
                reject();
            })

            socket.on("connect_document_success", (response: messages.IConnected) => {
                socket.removeListener("op", earlyOpHandler);
                socket.removeListener("op-content", earlyContentHandler);

                if (queuedMessages.length > 0) {
                    // some messages were queued.
                    // add them to the list of initialMessages to be processed
                    if (!response.initialMessages) {
                        response.initialMessages = [];
                    }

                    response.initialMessages.push(...queuedMessages);

                    response.initialMessages.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
                }

                if (queuedContents.length > 0) {
                    // some contents were queued.
                    // add them to the list of initialContents to be processed
                    if (!response.initialContents) {
                        response.initialContents = [];
                    }

                    response.initialContents.push(...queuedContents);

                    response.initialContents.sort((a, b) => (a.clientId === b.clientId) ? 0 : ((a.clientId < b.clientId)? -1 : 1) || a.clientSequenceNumber - b.clientSequenceNumber);
                }

                resolve(response);
            });

            socket.on("connect_document_error", (error => {
                debug(`Error connecting to the document after connecting to the socket. Error:[${error}]`);

                socket.disconnect();
                
                reject(error);
            }));

            socket.emit("connect_document", connectMessage);
        });

        const deltaConnection = new DocumentDeltaConnection(socket, id, connection);

        return deltaConnection;
    }

    private emitter = new EventEmitter();
    private submitManager: BatchManager<IDocumentMessage>;

    public get clientId(): string {
        return this.details.clientId;
    }

    public get existing(): boolean {
        return this.details.existing;
    }

    public get parentBranch(): string {
        return this.details.parentBranch;
    }

    public get maxMessageSize(): number {
        return this.details.maxMessageSize;
    }

    public get initialMessages(): ISequencedDocumentMessage[] {
        return this.details.initialMessages;
    }

    public get initialContents(): IContentMessage[] {
        return this.details.initialContents;
    }

    constructor(
        private socket: SocketIOClient.Socket,
        public documentId: string,
        public details: messages.IConnected) {
        super();

        this.submitManager = new BatchManager<IDocumentMessage>(
            (submitType, work) => {
                this.socket.emit(
                    submitType,
                    this.details.clientId,
                    work,
                    (error) => {
                        if (error) {
                            debug("Emit error", error);
                        }
                    });
            });
    }

    /**
     * Subscribe to events emitted by the document
     */
    public on(event: string, listener: (...args: any[]) => void): this {
        // Register for the event on socket.io
        this.socket.on(
            event,
            (...args: any[]) => {
                this.emitter.emit(event, ...args);
            });

        // And then add the listener to our event emitter
        this.emitter.on(event, listener);

        return this;
    }

    /**
     * Submits a new delta operation to the server
     */
    public submit(message: IDocumentMessage): void {
        this.submitManager.add("submitOp", message);
    }

    public async submitAsync(message: IDocumentMessage): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.socket.emit(
                "submitContent",
                this.details.clientId,
                message,
                (error) => {
                    if (error) {
                        reject();
                    } else {
                        resolve();
                    }
                });
        });
    }

    public disconnect() {
        this.socket.disconnect();
    }
}

/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ITelemetryBaseLogger } from "@prague/container-definitions";
import * as resources from "@prague/gitresources";
import { IDocumentService, IDocumentServiceFactory } from "@prague/protocol-definitions";
import * as io from "socket.io-client";
import { ISequencedDeltaOpMessage } from "../contracts";
import { FetchWrapper, IFetchWrapper } from "../fetchWrapper";
import { IOdspResolvedUrl } from "./contracts";
import { ExperimentalOdspDocumentService } from "./ExperimentalOdspDocumentService";

// tslint:disable-next-line: interface-name
export interface IOdspSnapshot {
  id: string;
  sha: string;
  trees: resources.ITree[];
  blobs: resources.IBlob[];
  ops: ISequencedDeltaOpMessage[];
}

/**
 * Factory for creating the sharepoint document service. Use this if you want to
 * use the sharepoint implementation.
 */
export class ExperimentalOdspDocumentServiceFactory implements IDocumentServiceFactory {
  public readonly protocolName = "prague-odsp:";
  /**
   * @param appId - app id used for telemetry for network requests.
   * @param getStorageToken - function that can provide the storage token for a given site. This is
   * is also referred to as the "VROOM" token in SPO.
   * @param getWebsocketToken - function that can provide a token for accessing the web socket. This is also
   * referred to as the "Push" token in SPO.
   * @param logger - a logger that can capture performance and diagnostic information
   * @param storageFetchWrapper - if not provided FetchWrapper will be used
   * @param deltasFetchWrapper - if not provided FetchWrapper will be used
   */
  constructor(
    private readonly appId: string,
    private readonly getStorageToken: (siteUrl: string) => Promise<string | null>,
    private readonly getWebsocketToken: () => Promise<string | null>,
    private readonly logger: ITelemetryBaseLogger,
    private readonly storageFetchWrapper: IFetchWrapper = new FetchWrapper(),
    private readonly deltasFetchWrapper: IFetchWrapper = new FetchWrapper(),
  ) {}

  public async createDocumentService(resolvedUrl: IOdspResolvedUrl): Promise<IDocumentService> {
    return new ExperimentalOdspDocumentService(
      this.appId,
      resolvedUrl.hashedDocumentId,
      resolvedUrl.siteUrl,
      resolvedUrl.driveId,
      resolvedUrl.itemId,
      resolvedUrl.endpoints.snapshotStorageUrl,
      this.getStorageToken,
      this.getWebsocketToken,
      this.logger,
      this.storageFetchWrapper,
      this.deltasFetchWrapper,
      Promise.resolve(io),
    );
  }
}